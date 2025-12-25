/**
 * Socket.IO event handlers for lobby management
 */

import { Server, Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  LobbyJoinEvent,
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
  socket.on('lobby:join', handleLobbyJoin(io, socket));
  socket.on('lobby:leave', handleLobbyLeave(io, socket));
  socket.on('disconnect', handleDisconnect(io, socket));
}

/**
 * Handle player joining a lobby
 * The lobbyId serves as the permanent room ID for Socket.IO
 */
function handleLobbyJoin(io: TypedServer, socket: TypedSocket) {
  return async (data: LobbyJoinEvent) => {
    try {
      const { lobbyId, playerId } = data;
      const roomId = lobbyId; // lobbyId serves as the permanent room ID

      // Get the lobby
      const lobby = lobbyService.getLobby(lobbyId);
      if (!lobby) {
        throw new Error('Lobby not found');
      }

      // Verify player exists in lobby
      const player = lobby.players.get(playerId);
      if (!player) {
        throw new Error('Player not found in lobby');
      }

      // Update socket ID for the existing player
      lobbyService.updateSocketId(lobbyId, playerId, socket.id);

      // Store in socket data
      (socket.data as SocketData).playerId = playerId;
      (socket.data as SocketData).lobbyId = lobbyId;

      // Save session to Redis
      redisService.setPlayerSession({
        playerId,
        lobbyId,
        socketId: socket.id,
        lastActive: new Date(),
      }).catch((err) => {
        console.error('[LobbyHandlers] Failed to save session:', err);
      });

      // Join Socket.IO room (room persists across lobby and game states)
      await socket.join(roomId);

      // Get updated lobby state
      const lobbyState = lobbyService.getLobbyState(lobbyId);
      if (!lobbyState) {
        throw new Error('Lobby not found after join');
      }

      // Notify all players in the room (including this socket)
      io.to(roomId).emit('lobby:playerJoined', {
        player,
        lobby: lobbyState,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to join lobby';
      socket.emit('error', { message: errorMessage } as any);
    }
  };
}

/**
 * Handle player leaving a lobby
 */
function handleLobbyLeave(io: TypedServer, socket: TypedSocket) {
  return async (data: { lobbyId: LobbyId; playerId: PlayerId }) => {
    try {
      const { lobbyId, playerId } = data;
      const roomId = lobbyId; // lobbyId serves as the permanent room ID

      // Get lobby state before leaving
      const lobbyBefore = lobbyService.getLobby(lobbyId);
      if (!lobbyBefore) {
        throw new Error('Lobby not found');
      }

      const wasLeader = lobbyBefore.leaderId === playerId;
      const oldLeaderId = lobbyBefore.leaderId;

      // Leave the lobby (this may reassign leader or delete lobby)
      lobbyService.leaveLobby(lobbyId, playerId);

      // Leave Socket.IO room
      await socket.leave(roomId);

      // Clear socket data
      delete (socket.data as SocketData).playerId;
      delete (socket.data as SocketData).lobbyId;

      // Clear session from Redis
      redisService.clearPlayerSession(playerId).catch((err) => {
        console.error('[LobbyHandlers] Failed to clear session:', err);
      });

      // Get updated lobby state (may be null if lobby deleted)
      const lobbyAfter = lobbyService.getLobbyState(lobbyId);

      if (lobbyAfter) {
        // Notify remaining players in room that someone left
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to leave lobby';
      socket.emit('error', { message: errorMessage } as any);
    }
  };
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
