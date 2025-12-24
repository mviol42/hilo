/**
 * Game management routes
 */

import { Router, Request, Response } from 'express';
import { lobbyService } from '../services/lobbyService';
import { StartGameRequest, StartGameResponse } from '@hilo/shared';

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

    // Transition lobby to in-game status
    lobbyService.transitionToGame(lobbyId);

    // TODO: Initialize game state from lobby using game engine
    // For now, return a minimal placeholder response
    const response: StartGameResponse = {
      gameState: {
        id: lobbyId,
        phase: 'setup',
        myHand: [],
        myFaceUp: [],
        myFaceDownCount: 0,
        otherPlayers: {},
        pile: [],
        deckCount: 52,
        activePlayerId: playerId,
      },
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

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
