/**
 * Lobby management routes
 */

import { Router, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { lobbyService } from '../services/lobbyService';
import {
  CreateLobbyResponse,
  JoinLobbyRequest,
  JoinLobbyResponse,
  LeaveLobbyRequest,
  LeaveLobbyResponse,
  ReadyLobbyRequest,
  ReadyLobbyResponse,
  ClientToServerEvents,
  ServerToClientEvents,
} from '@hilo/shared';

type TypedServer = SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

let io: TypedServer | null = null;

export function setLobbySocketIO(ioInstance: TypedServer): void {
  io = ioInstance;
}

export const lobbyRouter = Router();

/**
 * Validate UUID format (v4)
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * POST /api/lobby/create
 * Create a new lobby
 */
lobbyRouter.post('/create', async (req: Request, res: Response) => {
  try {
    const lobby = await lobbyService.createLobby();

    const response: CreateLobbyResponse = {
      lobbyId: lobby.id,
    };

    res.status(201).json(response);
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/lobby/join
 * Join an existing lobby
 */
lobbyRouter.post('/join', async (req: Request, res: Response) => {
  try {
    const { lobbyId, playerId, playerName } = req.body as JoinLobbyRequest;

    if (!lobbyId) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'lobbyId is required',
      });
    }

    if (!playerId) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'playerId is required',
      });
    }

    if (!isValidUUID(playerId)) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'playerId must be a valid UUID',
      });
    }

    const player = await lobbyService.joinLobby(lobbyId, playerId, playerName);
    const lobbyState = await lobbyService.getLobbyState(lobbyId);

    if (!lobbyState) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Lobby not found',
      });
    }

    const response: JoinLobbyResponse = {
      playerId: player.id,
      isLeader: player.isLeader,
      lobby: lobbyState,
    };

    res.status(200).json(response);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Lobby not found') {
        return res.status(404).json({
          error: 'Not found',
          message: error.message,
        });
      }

      if (error.message === 'Lobby is already in game') {
        return res.status(409).json({
          error: 'Conflict',
          message: error.message,
        });
      }

      if (error.message === 'Player ID already exists in this lobby') {
        return res.status(409).json({
          error: 'Conflict',
          message: error.message,
        });
      }
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/lobby/ready
 * Leave a lobby
 */
lobbyRouter.post('/ready', async (req: Request, res: Response) => {
  try {
    const { lobbyId, playerId } = req.body as ReadyLobbyRequest;

    if (!lobbyId || !playerId) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'lobbyId and playerId are required',
      });
    }

    const player = await lobbyService.readyPlayer(lobbyId, playerId);

    // Get updated lobby state (may be null if lobby was removed)
    const lobbyState = await lobbyService.getLobbyState(lobbyId);

    const response: ReadyLobbyResponse = {
      success: true,
      lobby: lobbyState || undefined,
    };

    // Emit WebSocket events (async, don't block HTTP response)
    if (io && lobbyState) {
      const roomId = lobbyId;
      const socketIo = io;
      setImmediate(() => {
        try {
          // Notify players in room that someone readied up
          socketIo.to(roomId).emit('lobby:playerReadied', {
            player,
            lobby: lobbyState,
          });
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

      if (error.message === 'Player not found in lobby') {
        return res.status(404).json({
          error: 'Not found',
          message: error.message,
        });
      }

      if (error.message === 'Leaders cannot ready - they should start instead') {
        return res.status(403).json({
          error: 'Unauthorized',
          message: error.message,
        });
      }
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/lobby/leave
 * Leave a lobby
 */
lobbyRouter.post('/leave', async (req: Request, res: Response) => {
  try {
    const { lobbyId, playerId } = req.body as LeaveLobbyRequest;

    if (!lobbyId || !playerId) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'lobbyId and playerId are required',
      });
    }

    // Get lobby state before leaving to check leader status
    const lobbyBefore = await lobbyService.getLobby(lobbyId);
    const wasLeader = lobbyBefore ? lobbyBefore.leaderId === playerId : false;
    const oldLeaderId = lobbyBefore?.leaderId;

    await lobbyService.leaveLobby(lobbyId, playerId);

    // Get updated lobby state (may be null if lobby was removed)
    const lobbyState = await lobbyService.getLobbyState(lobbyId);

    const response: LeaveLobbyResponse = {
      success: true,
      lobby: lobbyState || undefined,
    };

    // Emit WebSocket events (async, don't block HTTP response)
    if (io && lobbyState) {
      const roomId = lobbyId;
      const socketIo = io;
      setImmediate(() => {
        try {
          // Notify players in room that someone left
          socketIo.to(roomId).emit('lobby:playerLeft', {
            playerId,
            lobby: lobbyState,
          });

          // If leader changed, notify players
          if (wasLeader && lobbyState.leaderId !== oldLeaderId) {
            socketIo.to(roomId).emit('lobby:leaderChanged', {
              newLeaderId: lobbyState.leaderId,
              lobby: lobbyState,
            });
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

      if (error.message === 'Player not found in lobby') {
        return res.status(404).json({
          error: 'Not found',
          message: error.message,
        });
      }
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
