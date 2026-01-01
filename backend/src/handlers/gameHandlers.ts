/**
 * Socket.IO event handlers for game actions
 *
 * NOTE: WebSockets are READ-ONLY. All mutations are handled via HTTP API.
 * See /docs/backend-design.md for the architectural rule.
 */

import { Server, Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  GameRequestStateEvent,
} from '@hilo/shared';
import { gameService } from '../services/gameService';
import { logger } from '../config/logger';

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/**
 * Register all game-related event handlers
 * game:requestState is a read-only operation for state recovery on reconnect
 */
export function registerGameHandlers(_io: TypedServer, socket: TypedSocket): void {
  // Handle client requesting fresh game state (for reconnection recovery)
  socket.on('game:requestState', async (data: GameRequestStateEvent) => {
    const { gameId, playerId } = data;

    logger.info(`[Game] Player ${playerId} requesting state for game ${gameId}`);

    try {
      const playerView = await gameService.getPlayerView(gameId, playerId);

      if (playerView) {
        socket.emit('game:stateUpdate', { gameState: playerView });
        logger.info(`[Game] Sent state (v${playerView.stateVersion}) to player ${playerId}`);
      } else {
        socket.emit('error', { message: 'Game not found or player not in game' });
      }
    } catch (error) {
      logger.error(`[Game] Error getting state for player ${playerId}:`, error);
      socket.emit('error', { message: 'Failed to get game state' });
    }
  });
}

