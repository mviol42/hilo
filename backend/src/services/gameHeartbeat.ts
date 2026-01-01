/**
 * Game Heartbeat Service
 *
 * Manages periodic state broadcasts to connected players to ensure
 * clients recover from any dropped WebSocket messages.
 *
 * - Starts heartbeat when a game starts
 * - Broadcasts personalized state to each player every 5 seconds
 * - Stops when game ends or no players remain connected
 */

import { Server } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents, PlayerId } from '@hilo/shared';
import { gameService } from './gameService';
import { logger } from '../config/logger';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

const HEARTBEAT_INTERVAL_MS = 5000; // 5 seconds

interface GameHeartbeat {
  gameId: string;
  roomId: string; // The Socket.IO room (same as lobbyId)
  intervalId: NodeJS.Timeout;
  playerIds: PlayerId[]; // Players in the game
}

class GameHeartbeatManager {
  private heartbeats: Map<string, GameHeartbeat> = new Map();
  private io: TypedServer | null = null;

  /**
   * Initialize the heartbeat manager with the Socket.IO server
   */
  initialize(io: TypedServer): void {
    this.io = io;
    logger.info('[Heartbeat] GameHeartbeatManager initialized');
  }

  /**
   * Start heartbeat for a game
   * Called when a game starts
   */
  startHeartbeat(gameId: string, roomId: string, playerIds: PlayerId[]): void {
    if (!this.io) {
      logger.warn('[Heartbeat] Manager not initialized');
      return;
    }

    // Stop any existing heartbeat for this game
    this.stopHeartbeat(gameId);

    const intervalId = setInterval(
      () => this.broadcastGameState(gameId),
      HEARTBEAT_INTERVAL_MS
    );

    const heartbeat: GameHeartbeat = {
      gameId,
      roomId,
      intervalId,
      playerIds,
    };

    this.heartbeats.set(gameId, heartbeat);
    logger.info(`[Heartbeat] Started for game ${gameId.substring(0, 8)} with ${playerIds.length} players`);
  }

  /**
   * Stop heartbeat for a game
   */
  stopHeartbeat(gameId: string): void {
    const heartbeat = this.heartbeats.get(gameId);
    if (heartbeat) {
      clearInterval(heartbeat.intervalId);
      this.heartbeats.delete(gameId);
      logger.info(`[Heartbeat] Stopped for game ${gameId.substring(0, 8)}`);
    }
  }

  /**
   * Broadcast current game state to all players in the game
   * Each player gets their personalized view
   */
  private async broadcastGameState(gameId: string): Promise<void> {
    if (!this.io) return;

    const heartbeat = this.heartbeats.get(gameId);
    if (!heartbeat) return;

    try {
      // Get the game to check if it still exists and hasn't ended
      const game = await gameService.getGame(gameId);
      if (!game) {
        // Game no longer exists - clean up heartbeat
        this.stopHeartbeat(gameId);
        return;
      }

      // If game has ended, stop heartbeat
      if (game.phase === 'ended') {
        this.stopHeartbeat(gameId);
        return;
      }

      // Check if any sockets are connected to the room
      const sockets = await this.io.in(heartbeat.roomId).fetchSockets();
      if (sockets.length === 0) {
        // No connected clients - skip broadcast but keep heartbeat running
        // (players might reconnect)
        logger.debug(`[Heartbeat] No sockets in room ${heartbeat.roomId.substring(0, 8)}, skipping broadcast`);
        return;
      }

      // Broadcast personalized view to each player
      for (const playerId of heartbeat.playerIds) {
        try {
          const playerView = await gameService.getPlayerView(gameId, playerId);
          if (playerView) {
            // Find sockets for this player in the room
            for (const socket of sockets) {
              if (socket.data?.playerId === playerId) {
                socket.emit('game:stateUpdate', { gameState: playerView });
              }
            }
          }
        } catch (error) {
          // Player might have been removed - ignore
        }
      }

      logger.debug(`[Heartbeat] Broadcast state v${game.stateVersion} to room ${heartbeat.roomId.substring(0, 8)}`);
    } catch (error) {
      logger.error(`[Heartbeat] Error broadcasting game ${gameId.substring(0, 8)}:`, error);
    }
  }

  /**
   * Get the number of active heartbeats (for monitoring)
   */
  getActiveHeartbeatCount(): number {
    return this.heartbeats.size;
  }
}

// Export singleton instance
export const gameHeartbeatManager = new GameHeartbeatManager();

// Export class for testing
export { GameHeartbeatManager };
