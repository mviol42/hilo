/**
 * Session management routes for rejoin functionality
 */

import { Router, Request, Response } from 'express';
import { lobbyService } from '../services/lobbyService';
import { gameService } from '../services/gameService';
import { RejoinRequest, RejoinResponse } from '@hilo/shared';

/**
 * Validate UUID format (v4)
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export const sessionRouter = Router();

/**
 * POST /api/session/rejoin
 * Rejoin a lobby or game session based on player ID and either lobby ID or game ID.
 * Used for reconnection after page refresh or socket disconnect.
 */
sessionRouter.post('/rejoin', async (req: Request, res: Response) => {
  try {
    const { playerId, lobbyId, gameId } = req.body as RejoinRequest;

    // Validate playerId is required
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

    // Require at least one of lobbyId or gameId
    if (!lobbyId && !gameId) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Either lobbyId or gameId is required',
      });
    }

    let resolvedLobbyId = lobbyId;
    let activeGameId: string | undefined;

    // If gameId provided, look up the lobbyId from Redis mapping
    if (gameId) {
      const roomId = await gameService.getRoomIdFromGame(gameId);
      if (!roomId) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Game not found',
        });
      }
      resolvedLobbyId = roomId;
      activeGameId = gameId;
    }

    // Get lobby state
    const lobby = await lobbyService.getLobby(resolvedLobbyId!);
    if (!lobby) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Lobby not found',
      });
    }

    // Verify player is in lobby
    if (!lobby.players.has(playerId)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Player not in lobby',
        code: 'NOT_IN_LOBBY',
      });
    }

    // Check for active game if not already determined via gameId
    if (!activeGameId && lobby.status === 'in_game') {
      const game = await gameService.getGameByRoom(resolvedLobbyId!);
      if (game) {
        activeGameId = game.id;
      }
    }

    // Build response
    const lobbyState = await lobbyService.getLobbyState(resolvedLobbyId!);
    if (!lobbyState) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Lobby not found',
      });
    }

    const response: RejoinResponse = {
      success: true,
      lobbyId: resolvedLobbyId!,
      lobby: lobbyState,
    };

    // Include game state if there's an active game
    if (activeGameId) {
      const gameState = await gameService.getPlayerView(activeGameId, playerId);
      if (gameState) {
        response.gameId = activeGameId;
        response.gameState = gameState;
      }
    }

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
