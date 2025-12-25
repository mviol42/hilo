/**
 * Socket.IO event handlers for lobby management
 *
 * NOTE: WebSockets are READ-ONLY. All mutations are handled via HTTP API.
 * See /docs/backend-design.md for the architectural rule.
 */

import { Server, Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@hilo/shared';
import { LobbyId, PlayerId } from '@hilo/shared';
import { lobbyService } from '../services/lobbyService';
import { redisService } from '../services/redisService';

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// Socket data interface
interface SocketData {
  playerId?: PlayerId;
  lobbyId?: LobbyId;
}

/**
 * Register all lobby-related event handlers
 */
export function registerLobbyHandlers(io: TypedServer, socket: TypedSocket): void {
  socket.on('disconnect', handleDisconnect(io, socket));
}


/**
 * Handle socket disconnection
 */
function handleDisconnect(io: TypedServer, socket: TypedSocket) {
  return async () => {
    try {
      const socketData = socket.data as SocketData;
      const { playerId, lobbyId } = socketData;

      // If player was in a lobby/room, handle leave
      if (playerId && lobbyId) {
        const roomId = lobbyId; // lobbyId serves as the permanent room ID
        const lobbyBefore = lobbyService.getLobby(lobbyId);
        if (!lobbyBefore) {
          return; // Lobby already gone
        }

        const wasLeader = lobbyBefore.leaderId === playerId;
        const oldLeaderId = lobbyBefore.leaderId;

        // Leave the lobby
        lobbyService.leaveLobby(lobbyId, playerId);

        // Clear session from Redis
        redisService.clearPlayerSession(playerId).catch((err) => {
          console.error('[LobbyHandlers] Failed to clear session on disconnect:', err);
        });

        // Get updated lobby state
        const lobbyAfter = lobbyService.getLobbyState(lobbyId);

        if (lobbyAfter) {
          // Notify remaining players in room
          io.to(roomId).emit('lobby:playerLeft', {
            playerId,
            lobby: lobbyAfter,
          });

          // If leader changed, notify players
          if (wasLeader && lobbyAfter.leaderId !== oldLeaderId) {
            io.to(roomId).emit('lobby:leaderChanged', {
              newLeaderId: lobbyAfter.leaderId,
              lobby: lobbyAfter,
            });
          }
        }
      }
    } catch (error) {
      // Log error but don't emit to disconnected socket
      console.error('Error handling disconnect:', error);
    }
  };
}
