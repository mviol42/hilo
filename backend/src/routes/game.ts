/**
 * Game management routes
 */

import { Router, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { lobbyService } from '../services/lobbyService';
import { gameService } from '../services/gameService';
import { redisService } from '../services/redisService';
import {
  StartGameRequest,
  StartGameResponse,
  SelectFaceUpRequest,
  SelectFaceUpResponse,
  PlayCardsRequest,
  PlayCardsResponse,
  PickUpPileRequest,
  PickUpPileResponse,
  PlayerId,
  GameLogEntry,
} from '@hilo/shared';
import { ClientToServerEvents, ServerToClientEvents } from '@hilo/shared';

type TypedServer = SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

let io: TypedServer | null = null;

export function setSocketIO(ioInstance: TypedServer): void {
  io = ioInstance;
}

export const gameRouter = Router();

/**
 * POST /api/game/start
 * Start a game (leader only)
 */
gameRouter.post('/start', async (req: Request, res: Response) => {
  try {
    const { lobbyId, playerId } = req.body as StartGameRequest;

    if (!lobbyId || !playerId) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'lobbyId and playerId are required',
      });
    }

    // Validate player can start game
    await lobbyService.canStartGame(lobbyId, playerId);

    // Get lobby to extract player IDs in turn order
    const lobby = await lobbyService.getLobby(lobbyId);
    if (!lobby) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Lobby not found',
      });
    }

    // Transition lobby to in-game status
    await lobbyService.transitionToGame(lobbyId);

    // Create game with players from lobby
    // lobbyId serves as the permanent room ID for Socket.IO
    const playerIds = Array.from(lobby.players.keys());
    const gameState = await gameService.createGame(lobbyId, playerIds);

    // Return game state for the requesting player
    const playerView = await gameService.getPlayerView(gameState.id, playerId);

    if (!playerView) {
      throw new Error('Failed to get player view');
    }

    const response: StartGameResponse = {
      gameState: playerView,
    };

    // Emit lobby:gameStarting event via Socket.IO (async, don't await)
    // Broadcast to the room (lobbyId serves as room ID)
    if (io) {
      const roomId = lobbyId;
      const socketIo = io; // Capture to avoid null check inside callback
      setImmediate(async () => {
        try {
          socketIo.to(roomId).emit('lobby:gameStarting', {
            gameId: gameState.id,
          });

          // Broadcast initial game state to all players in the room
          const sockets = await socketIo.in(roomId).fetchSockets();
          for (const pid of playerIds) {
            const pView = await gameService.getPlayerView(gameState.id, pid);
            if (pView) {
              for (const socket of sockets) {
                const socketData = socket.data as any;
                if (socketData.playerId === pid) {
                  socket.emit('game:stateUpdate', {
                    gameState: pView,
                  });
                  break;
                }
              }
            }
          }
        } catch (error) {
          console.error('Error emitting WebSocket events:', error);
        }
      });
    }

    res.status(200).json(response);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Lobby not found') {
        return res.status(404).json({
          error: 'Not found',
          message: error.message,
        });
      }

      if (error.message === 'Only the leader can start the game') {
        return res.status(403).json({
          error: 'Forbidden',
          message: error.message,
        });
      }

      if (error.message === 'Need at least 2 players to start') {
        return res.status(400).json({
          error: 'Bad request',
          message: error.message,
        });
      }

      if (error.message === 'Players are not ready') {
        return res.status(400).json({
          error: 'Bad request',
          message: error.message,
        });
      }

      if (error.message === 'Game already started') {
        return res.status(409).json({
          error: 'Conflict',
          message: error.message,
        });
      }
    }

    console.error('Error starting game:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/game/select-faceup
 * Player selects 3 face-up cards during setup phase
 */
gameRouter.post('/select-faceup', async (req: Request, res: Response) => {
  try {
    const { gameId, playerId, cards } = req.body as SelectFaceUpRequest;

    if (!gameId || !playerId || !cards || !Array.isArray(cards)) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'gameId, playerId, and cards array are required',
      });
    }

    if (cards.length !== 3) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Must select exactly 3 cards',
      });
    }

    // Get game state
    const game = await gameService.getGame(gameId);
    if (!game) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Game not found',
      });
    }

    const playerState = game.players.get(playerId);
    if (!playerState) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Player not found in game',
      });
    }

    // Find indices of the selected cards
    const cardIndices: number[] = [];
    for (const selectedCard of cards) {
      const index = playerState.hand.findIndex(
        (c) => c.rank === selectedCard.rank && c.suit === selectedCard.suit
      );
      if (index === -1) {
        return res.status(400).json({
          error: 'Bad request',
          message: 'Card not in hand',
        });
      }
      cardIndices.push(index);
    }

    // Select face-up cards
    const updatedGame = await gameService.selectFaceUp(gameId, playerId, cardIndices);

    // Log action to Redis
    const logEntry: GameLogEntry = {
      timestamp: new Date(),
      playerId,
      action: 'select_faceup',
      cards,
      description: `Player ${playerId.substring(0, 8)} selected face-up cards`,
    };
    redisService.logGameAction(gameId, logEntry).catch((err) => {
      console.error('[GameRoutes] Failed to log action:', err);
    });

    // Broadcast state update to all players via WebSocket
    if (io) {
      await broadcastGameState(io, gameId, updatedGame.turnOrder);

      // Check if all players have selected
      if (await gameService.allPlayersReady(gameId)) {
        // Start the game
        const startedGame = await gameService.startGamePlay(gameId);

        // Broadcast updated state with first active player
        await broadcastGameState(io, gameId, startedGame.turnOrder);

        // Emit turn change event to room
        const roomId = await gameService.getRoomIdFromGame(gameId);
        if (roomId) {
          io.to(roomId).emit('game:turnChange', {
            activePlayerId: startedGame.activePlayerId,
          });
        }
      }
    }

    // Return player's view
    const playerView = await gameService.getPlayerView(gameId, playerId);
    if (!playerView) {
      throw new Error('Failed to get player view');
    }

    const response: SelectFaceUpResponse = {
      gameState: playerView,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error selecting face-up cards:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/game/play-cards
 * Player plays cards from hand/face-up/face-down
 */
gameRouter.post('/play-cards', async (req: Request, res: Response) => {
  try {
    const { gameId, playerId, cards, faceDownIndex } = req.body as PlayCardsRequest;

    if (!gameId || !playerId || !cards || !Array.isArray(cards)) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'gameId, playerId, and cards array are required',
      });
    }

    // Play the cards
    const { gameState, blowUp, winner, cardsPlayed } = await gameService.playCardsAction(gameId, playerId, cards, faceDownIndex);

    // Log action to Redis
    const action: 'play_cards' | 'blow_up' = blowUp ? 'blow_up' : 'play_cards';
    const description = blowUp
      ? `Player ${playerId.substring(0, 8)} played ${cardsPlayed.length} card(s) and blew up the pile`
      : `Player ${playerId.substring(0, 8)} played ${cardsPlayed.length} card(s)`;

    const logEntry: GameLogEntry = {
      timestamp: new Date(),
      playerId,
      action,
      cards: cardsPlayed,
      description,
    };
    redisService.logGameAction(gameId, logEntry).catch((err) => {
      console.error('[GameRoutes] Failed to log action:', err);
    });

    // Broadcast via WebSocket
    if (io) {
      const roomId = await gameService.getRoomIdFromGame(gameId);
      if (roomId) {
        // If blow-up occurred, notify all players in room
        if (blowUp && cardsPlayed.length > 0) {
          const reason = cardsPlayed[0].rank === '10' ? 'ten' : 'four_of_kind';
          io.to(roomId).emit('game:pileBlown', {
            playerId,
            reason,
          });
        }

        // Broadcast state update to all players
        await broadcastGameState(io, gameId, gameState.turnOrder);

        // Emit turn change event to room
        io.to(roomId).emit('game:turnChange', {
          activePlayerId: gameState.activePlayerId,
        });

        // If player won, emit winner event to room
        if (winner && gameState.winner) {
          // Get player name from game state
          const player = gameState.players.get(gameState.winner);
          const winnerName = player ? `Player ${gameState.winner.substring(0, 8)}` : 'Unknown';

          io.to(roomId).emit('game:playerWon', {
            winnerId: gameState.winner,
            winnerName,
          });
        }
      }
    }

    // Return player's view
    const playerView = await gameService.getPlayerView(gameId, playerId);
    if (!playerView) {
      throw new Error('Failed to get player view');
    }

    const response: PlayCardsResponse = {
      gameState: playerView,
      blowUp,
      winner,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error playing cards:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/game/pickup-pile
 * Player picks up the pile
 */
gameRouter.post('/pickup-pile', async (req: Request, res: Response) => {
  try {
    const { gameId, playerId } = req.body as PickUpPileRequest;

    if (!gameId || !playerId) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'gameId and playerId are required',
      });
    }

    // Pick up the pile
    const updatedGame = await gameService.pickUpPileAction(gameId, playerId);

    // Log action to Redis
    const logEntry: GameLogEntry = {
      timestamp: new Date(),
      playerId,
      action: 'pickup_pile',
      description: `Player ${playerId.substring(0, 8)} picked up the pile`,
    };
    redisService.logGameAction(gameId, logEntry).catch((err) => {
      console.error('[GameRoutes] Failed to log action:', err);
    });

    // Broadcast via WebSocket
    if (io) {
      const roomId = await gameService.getRoomIdFromGame(gameId);
      if (roomId) {
        // Broadcast state update to all players
        await broadcastGameState(io, gameId, updatedGame.turnOrder);

        // Emit turn change event to room
        io.to(roomId).emit('game:turnChange', {
          activePlayerId: updatedGame.activePlayerId,
        });
      }
    }

    // Return player's view
    const playerView = await gameService.getPlayerView(gameId, playerId);
    if (!playerView) {
      throw new Error('Failed to get player view');
    }

    const response: PickUpPileResponse = {
      gameState: playerView,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error picking up pile:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Helper: Broadcast personalized game state to all players in the room
 */
async function broadcastGameState(
  io: TypedServer,
  gameId: string,
  playerIds: PlayerId[]
): Promise<void> {
  // Get the room ID for this game
  const roomId = await gameService.getRoomIdFromGame(gameId);
  if (!roomId) {
    return;
  }

  // Get all sockets in the room
  const sockets = await io.in(roomId).fetchSockets();

  for (const playerId of playerIds) {
    const playerView = await gameService.getPlayerView(gameId, playerId);
    if (playerView) {
      // Find the socket for this player
      for (const socket of sockets) {
        const socketData = socket.data as any;
        if (socketData.playerId === playerId) {
          socket.emit('game:stateUpdate', {
            gameState: playerView,
          });
          break;
        }
      }
    }
  }
}
