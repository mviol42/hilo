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
  LobbyJoinEvent,
} from '@hilo/shared';
import { LobbyId, PlayerId } from '@hilo/shared';
import { lobbyService } from '../services/lobbyService';
import { redisService } from '../services/redisService';
import { cancelPendingDeletion, scheduleLobbyCleanup } from './lobbyCleanup';

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
 * Handle player joining a lobby room via WebSocket
 * NOTE: This does NOT mutate lobby state. Players must join via HTTP API first.
 * This handler only subscribes the socket to room events.
 */
function handleLobbyJoin(io: TypedServer, socket: TypedSocket) {
  return async (data: LobbyJoinEvent) => {
    try {
      const { lobbyId, playerId } = data;
      const roomId = lobbyId; // lobbyId serves as the permanent room ID

      // Get the lobby
      const lobby = await lobbyService.getLobby(lobbyId);
      if (!lobby) {
        throw new Error('Lobby not found');
      }

      // Verify player exists in lobby (must have joined via HTTP API first)
      const player = lobby.players.get(playerId);
      if (!player) {
        throw new Error('Player not found in lobby');
      }

      // Cancel any pending deletion for this player (they're reconnecting)
      cancelPendingDeletion(lobbyId, playerId);

      // Update socket ID for the existing player
      await lobbyService.updateSocketId(lobbyId, playerId, socket.id);

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

      console.log(`[LobbyHandlers] Player ${playerId.substring(0, 8)} joined lobby ${lobbyId.substring(0, 8)}, socket: ${socket.id}`);

      // Get updated lobby state
      const lobbyState = await lobbyService.getLobbyState(lobbyId);
      if (!lobbyState) {
        throw new Error('Lobby not found after join');
      }

      console.log(`[LobbyHandlers] Lobby state after join - players: ${lobbyState.players.map(p => p.id.substring(0, 8)).join(', ')}`);

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
 * Handle player leaving a lobby room via WebSocket
 * NOTE: This does NOT mutate lobby state. Players must leave via HTTP API.
 * This handler only unsubscribes the socket from room events.
 */
function handleLobbyLeave(_io: TypedServer, socket: TypedSocket) {
  return async (data: { lobbyId: LobbyId; playerId: PlayerId }) => {
    try {
      const { lobbyId, playerId } = data;
      const roomId = lobbyId; // lobbyId serves as the permanent room ID

      // Leave Socket.IO room
      await socket.leave(roomId);

      // Clear socket data
      delete (socket.data as SocketData).playerId;
      delete (socket.data as SocketData).lobbyId;

      // Clear session from Redis
      redisService.clearPlayerSession(playerId).catch((err) => {
        console.error('[LobbyHandlers] Failed to clear session:', err);
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to leave lobby';
      socket.emit('error', { message: errorMessage } as any);
    }
  };
}


/**
 * Handle socket disconnection
 *
 * Behavior depends on lobby state:
 * - WAITING: Remove player from lobby (they can rejoin via join flow)
 * - IN_GAME: Keep player in lobby so they can reconnect and rejoin the game
 */
function handleDisconnect(io: TypedServer, socket: TypedSocket) {
  return async () => {
    try {
      const socketData = socket.data as SocketData;
      const { playerId, lobbyId } = socketData;

      if (!playerId || !lobbyId) {
        return;
      }

      const lobby = await lobbyService.getLobby(lobbyId);
      if (!lobby) {
        return; // Lobby already gone
      }

      console.log(`[LobbyHandlers] Player ${playerId.substring(0, 8)} disconnected from lobby ${lobbyId.substring(0, 8)}, status: ${lobby.status}`);

      // If game is in progress, keep the player so they can reconnect
      if (lobby.status === 'in_game') {
        console.log(`[LobbyHandlers] Game in progress, keeping player for potential rejoin`);
        return;
      }

      // If in waiting/lobby state, schedule cleanup with grace period
      const wasLeader = lobby.leaderId === playerId;
      const oldLeaderId = lobby.leaderId;

      // Schedule delayed cleanup to allow quick reconnections
      scheduleLobbyCleanup(io, lobbyId, playerId, wasLeader, oldLeaderId);
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  };
}
