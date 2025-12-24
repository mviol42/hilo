/**
 * Socket.IO event handlers for game actions
 */

import { Server, Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  GameSelectFaceUpEvent,
  GamePlayCardsEvent,
  GamePickUpPileEvent,
  GameLogEntry,
} from '@hilo/shared';
import { PlayerId } from '@hilo/shared';
import { gameService } from '../services/gameService';
import { redisService } from '../services/redisService';

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/**
 * Register all game-related event handlers
 */
export function registerGameHandlers(io: TypedServer, socket: TypedSocket): void {
  socket.on('game:selectFaceUp', handleSelectFaceUp(io, socket));
  socket.on('game:playCards', handlePlayCards(io, socket));
  socket.on('game:pickUpPile', handlePickUpPile(io, socket));
}

/**
 * Handle player selecting face-up cards during setup
 */
function handleSelectFaceUp(io: TypedServer, socket: TypedSocket) {
  return async (data: GameSelectFaceUpEvent) => {
    try {
      const { gameId, playerId, cards } = data;

      // Convert cards to indices (cards are in hand at positions 0-5)
      const game = gameService.getGame(gameId);
      if (!game) {
        throw new Error('Game not found');
      }

      const playerState = game.players.get(playerId);
      if (!playerState) {
        throw new Error('Player not found');
      }

      // Find indices of the selected cards
      const cardIndices: number[] = [];
      for (const selectedCard of cards) {
        const index = playerState.hand.findIndex(
          (c) => c.rank === selectedCard.rank && c.suit === selectedCard.suit
        );
        if (index === -1) {
          throw new Error('Card not in hand');
        }
        cardIndices.push(index);
      }

      // Select face-up cards
      const updatedGame = gameService.selectFaceUp(gameId, playerId, cardIndices);

      // Log action to Redis
      const logEntry: GameLogEntry = {
        timestamp: new Date(),
        playerId,
        action: 'select_faceup',
        cards,
        description: `Player ${playerId.substring(0, 8)} selected face-up cards`,
      };
      redisService.logGameAction(gameId, logEntry).catch((err) => {
        console.error('[GameHandlers] Failed to log action:', err);
      });

      // Broadcast state update to all players
      await broadcastGameState(io, gameId, updatedGame.turnOrder);

      // Check if all players have selected
      if (gameService.allPlayersReady(gameId)) {
        // Start the game
        const startedGame = gameService.startGamePlay(gameId);

        // Broadcast updated state with first active player
        await broadcastGameState(io, gameId, startedGame.turnOrder);

        // Emit turn change event to room
        const roomId = gameService.getRoomIdFromGame(gameId);
        if (roomId) {
          io.to(roomId).emit('game:turnChange', {
            activePlayerId: startedGame.activePlayerId,
          });
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to select face-up cards';
      socket.emit('error', { message: errorMessage } as any);
    }
  };
}

/**
 * Handle player playing cards
 */
function handlePlayCards(io: TypedServer, socket: TypedSocket) {
  return async (data: GamePlayCardsEvent) => {
    try {
      const { gameId, playerId, cards } = data;

      // Play the cards
      const { gameState, blowUp, winner } = gameService.playCardsAction(gameId, playerId, cards);

      // Log action to Redis
      const action: 'play_cards' | 'blow_up' = blowUp ? 'blow_up' : 'play_cards';
      const description = blowUp
        ? `Player ${playerId.substring(0, 8)} played ${cards.length} card(s) and blew up the pile`
        : `Player ${playerId.substring(0, 8)} played ${cards.length} card(s)`;

      const logEntry: GameLogEntry = {
        timestamp: new Date(),
        playerId,
        action,
        cards,
        description,
      };
      redisService.logGameAction(gameId, logEntry).catch((err) => {
        console.error('[GameHandlers] Failed to log action:', err);
      });

      const roomId = gameService.getRoomIdFromGame(gameId);
      if (!roomId) {
        return;
      }

      // If blow-up occurred, notify all players in room
      if (blowUp) {
        const reason = cards[0].rank === '10' ? 'ten' : 'four_of_kind';
        io.to(roomId).emit('game:pileBlown', {
          playerId,
          reason,
        });
      }

      // Broadcast state update to all players
      await broadcastGameState(io, gameId, gameState.turnOrder);

      // If turn changed, emit turn change event to room
      io.to(roomId).emit('game:turnChange', {
        activePlayerId: gameState.activePlayerId,
      });

      // If player won, emit winner event to room
      if (winner && gameState.winner) {
        // Get player name from lobby
        const player = await getPlayerFromLobby(gameId, gameState.winner);
        const winnerName = player?.name || 'Unknown';

        io.to(roomId).emit('game:playerWon', {
          winnerId: gameState.winner,
          winnerName,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to play cards';
      socket.emit('error', { message: errorMessage } as any);
    }
  };
}

/**
 * Handle player picking up the pile
 */
function handlePickUpPile(io: TypedServer, socket: TypedSocket) {
  return async (data: GamePickUpPileEvent) => {
    try {
      const { gameId, playerId } = data;

      // Pick up the pile
      const updatedGame = gameService.pickUpPileAction(gameId, playerId);

      // Log action to Redis
      const logEntry: GameLogEntry = {
        timestamp: new Date(),
        playerId,
        action: 'pickup_pile',
        description: `Player ${playerId.substring(0, 8)} picked up the pile`,
      };
      redisService.logGameAction(gameId, logEntry).catch((err) => {
        console.error('[GameHandlers] Failed to log action:', err);
      });

      const roomId = gameService.getRoomIdFromGame(gameId);
      if (!roomId) {
        return;
      }

      // Broadcast state update to all players
      await broadcastGameState(io, gameId, updatedGame.turnOrder);

      // Emit turn change event to room
      io.to(roomId).emit('game:turnChange', {
        activePlayerId: updatedGame.activePlayerId,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to pick up pile';
      socket.emit('error', { message: errorMessage } as any);
    }
  };
}

/**
 * Broadcast personalized game state to all players in the room
 * The room persists across multiple games - lobbyId serves as the permanent room ID
 */
async function broadcastGameState(
  io: TypedServer,
  gameId: string,
  playerIds: PlayerId[]
): Promise<void> {
  // Get the room ID for this game
  const roomId = gameService.getRoomIdFromGame(gameId);
  if (!roomId) {
    return;
  }

  // Get all sockets in the room
  const sockets = await io.in(roomId).fetchSockets();

  for (const playerId of playerIds) {
    const playerView = gameService.getPlayerView(gameId, playerId);
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

/**
 * Get player info from lobby (helper function)
 */
async function getPlayerFromLobby(gameId: string, playerId: PlayerId) {
  // Find lobby by iterating (we don't have reverse lookup yet)
  // This is a simple implementation - could be optimized
  const game = gameService.getGame(gameId);
  if (!game) {
    return null;
  }

  // Try to find the lobby that has this game
  // For now, we'll use the gameId as lobbyId (need to track this better)
  // This is a limitation we'll address in the HTTP route integration
  return { name: `Player ${playerId.substring(0, 8)}` };
}
