/**
 * Notification service for broadcasting state changes via WebSocket
 */

import { Server as SocketIOServer } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  LobbyState,
  Player,
  PlayerId,
  LobbyId,
} from '@hilo/shared';

type TypedServer = SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

export class NotificationService {
  private io: TypedServer | null = null;

  /**
   * Set the Socket.IO server instance
   */
  setSocketIO(ioInstance: TypedServer): void {
    this.io = ioInstance;
  }

  /**
   * Notify players that a player joined the lobby
   * @param _lobbyId - The lobby ID (unused - kept for API compatibility)
   * @param player - The player who joined
   * @param lobbyState - The updated lobby state
   */
  notifyPlayerJoined(_lobbyId: LobbyId, player: Player, lobbyState: LobbyState): void {
    if (!this.io) {
      return;
    }

    const socketIo = this.io;

    setImmediate(() => {
      try {
        // Emit to each player's socket directly
        lobbyState.players.forEach((p) => {
          if (p.socketId) {
            socketIo.to(p.socketId).emit('lobby:playerJoined', {
              player,
              lobby: lobbyState,
            });
          }
        });
      } catch (error) {
        console.error('Error emitting lobby:playerJoined event:', error);
      }
    });
  }

  /**
   * Notify players that a player left the lobby
   * @param _lobbyId - The lobby ID (unused - kept for API compatibility)
   * @param playerId - The player ID who left
   * @param lobbyState - The updated lobby state
   */
  notifyPlayerLeft(_lobbyId: LobbyId, playerId: PlayerId, lobbyState: LobbyState): void {
    if (!this.io) {
      return;
    }

    const socketIo = this.io;

    setImmediate(() => {
      try {
        // Emit to each player's socket directly
        lobbyState.players.forEach((p) => {
          if (p.socketId) {
            socketIo.to(p.socketId).emit('lobby:playerLeft', {
              playerId,
              lobby: lobbyState,
            });
          }
        });
      } catch (error) {
        console.error('Error emitting lobby:playerLeft event:', error);
      }
    });
  }

  /**
   * Notify players that the lobby leader changed
   * @param _lobbyId - The lobby ID (unused - kept for API compatibility)
   * @param newLeaderId - The new leader's player ID
   * @param lobbyState - The updated lobby state
   */
  notifyLeaderChanged(_lobbyId: LobbyId, newLeaderId: PlayerId, lobbyState: LobbyState): void {
    if (!this.io) {
      return;
    }

    const socketIo = this.io;

    setImmediate(() => {
      try {
        // Emit to each player's socket directly
        lobbyState.players.forEach((p) => {
          if (p.socketId) {
            socketIo.to(p.socketId).emit('lobby:leaderChanged', {
              newLeaderId,
              lobby: lobbyState,
            });
          }
        });
      } catch (error) {
        console.error('Error emitting lobby:leaderChanged event:', error);
      }
    });
  }
}

// Singleton instance
export const notificationService = new NotificationService();
