/**
 * Game management routes
 */

import { Router, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { lobbyService } from '../services/lobbyService';
import { gameService } from '../services/gameService';
import { StartGameRequest, StartGameResponse } from '@hilo/shared';
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
gameRouter.post('/start', (req: Request, res: Response) => {
  try {
    const { lobbyId, playerId } = req.body as StartGameRequest;

    if (!lobbyId || !playerId) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'lobbyId and playerId are required',
      });
    }

    // Validate player can start game
    lobbyService.canStartGame(lobbyId, playerId);

    // Get lobby to extract player IDs in turn order
    const lobby = lobbyService.getLobby(lobbyId);
    if (!lobby) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Lobby not found',
      });
    }

    // Transition lobby to in-game status
    lobbyService.transitionToGame(lobbyId);

    // Create game with players from lobby
    // lobbyId serves as the permanent room ID for Socket.IO
    const playerIds = Array.from(lobby.players.keys());
    const gameState = gameService.createGame(lobbyId, playerIds);

    // Return game state for the requesting player
    const playerView = gameService.getPlayerView(gameState.id, playerId);

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
            const pView = gameService.getPlayerView(gameState.id, pid);
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
