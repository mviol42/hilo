/**
 * Lobby management routes
 */

import { Router, Request, Response } from 'express';
import { lobbyService } from '../services/lobbyService';
import {
  CreateLobbyResponse,
  JoinLobbyRequest,
  JoinLobbyResponse,
  LeaveLobbyRequest,
  LeaveLobbyResponse,
} from '@hilo/shared';

export const lobbyRouter = Router();

/**
 * POST /api/lobby/create
 * Create a new lobby
 */
lobbyRouter.post('/create', (req: Request, res: Response) => {
  try {
    const lobby = lobbyService.createLobby();

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
lobbyRouter.post('/join', (req: Request, res: Response) => {
  try {
    const { lobbyId, playerName } = req.body as JoinLobbyRequest;

    if (!lobbyId) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'lobbyId is required',
      });
    }

    const player = lobbyService.joinLobby(lobbyId, playerName);
    const lobbyState = lobbyService.getLobbyState(lobbyId);

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
lobbyRouter.post('/leave', (req: Request, res: Response) => {
  try {
    const { lobbyId, playerId } = req.body as LeaveLobbyRequest;

    if (!lobbyId || !playerId) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'lobbyId and playerId are required',
      });
    }

    lobbyService.leaveLobby(lobbyId, playerId);

    // Get updated lobby state (may be null if lobby was removed)
    const lobbyState = lobbyService.getLobbyState(lobbyId);

    const response: LeaveLobbyResponse = {
      success: true,
      lobby: lobbyState || undefined,
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
