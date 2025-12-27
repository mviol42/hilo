/**
 * Lobby cleanup with grace period for disconnections
 *
 * When a player disconnects from a waiting lobby, we don't immediately remove them.
 * Instead, we schedule cleanup after a grace period to allow quick reconnections
 * (e.g., when switching apps on iOS to share lobby links).
 */

import { LobbyId, PlayerId } from '@hilo/shared';
import { lobbyService } from '../services/lobbyService';
import { redisService } from '../services/redisService';
import { logger } from '../config/logger';
import type { TypedServer } from './lobbyHandlers';

// Grace period for lobby cleanup after disconnect (60 seconds)
const LOBBY_DISCONNECT_GRACE_PERIOD_MS = 60 * 1000;

// Track pending lobby deletions: Map<lobbyId, Map<playerId, timeoutId>>
const pendingLobbyDeletions = new Map<LobbyId, Map<PlayerId, NodeJS.Timeout>>();

/**
 * Cancel a pending lobby deletion for a specific player
 * @returns true if a pending deletion was cancelled, false if none existed
 */
export function cancelPendingDeletion(lobbyId: LobbyId, playerId: PlayerId): boolean {
  const lobbyDeletions = pendingLobbyDeletions.get(lobbyId);
  if (!lobbyDeletions) {
    return false;
  }

  const timeout = lobbyDeletions.get(playerId);
  if (!timeout) {
    return false;
  }

  clearTimeout(timeout);
  lobbyDeletions.delete(playerId);

  // Clean up empty lobby deletion maps
  if (lobbyDeletions.size === 0) {
    pendingLobbyDeletions.delete(lobbyId);
  }

  logger.info(`[LobbyCleanup] Cancelled pending deletion for player ${playerId.substring(0, 8)} from lobby ${lobbyId.substring(0, 8)}`);
  return true;
}

/**
 * Perform the actual cleanup of a disconnected player
 * This is the core cleanup logic separated from the scheduling mechanism
 */
export async function performPlayerCleanup(
  io: TypedServer,
  lobbyId: LobbyId,
  playerId: PlayerId,
  wasLeader: boolean,
  oldLeaderId: string
): Promise<void> {
  try {
    logger.info(`[LobbyCleanup] Performing cleanup for player ${playerId.substring(0, 8)} in lobby ${lobbyId.substring(0, 8)}`);

    // Remove from pending deletions tracking
    const lobbyDeletions = pendingLobbyDeletions.get(lobbyId);
    if (lobbyDeletions) {
      lobbyDeletions.delete(playerId);
      if (lobbyDeletions.size === 0) {
        pendingLobbyDeletions.delete(lobbyId);
      }
    }

    // Check if lobby still exists
    const lobby = await lobbyService.getLobby(lobbyId);
    if (!lobby) {
      logger.info(`[LobbyCleanup] Lobby ${lobbyId.substring(0, 8)} no longer exists, skipping cleanup`);
      return;
    }

    // Check if player is still in the lobby (they might have already left)
    if (!lobby.players.has(playerId)) {
      logger.info(`[LobbyCleanup] Player ${playerId.substring(0, 8)} already removed from lobby ${lobbyId.substring(0, 8)}`);
      return;
    }

    const roomId = lobbyId;

    // Leave the lobby
    await lobbyService.leaveLobby(lobbyId, playerId);

    // Clear session from Redis
    redisService.clearPlayerSession(playerId).catch((err) => {
      logger.error('[LobbyCleanup] Failed to clear session after grace period:', err);
    });

    // Get updated lobby state
    const lobbyAfter = await lobbyService.getLobbyState(lobbyId);

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

    logger.info(`[LobbyCleanup] Completed cleanup for player ${playerId.substring(0, 8)} from lobby ${lobbyId.substring(0, 8)}`);
  } catch (error) {
    logger.error('[LobbyCleanup] Error during player cleanup:', error);
  }
}

/**
 * Schedule a delayed lobby cleanup for a disconnected player
 */
export function scheduleLobbyCleanup(
  io: TypedServer,
  lobbyId: LobbyId,
  playerId: PlayerId,
  wasLeader: boolean,
  oldLeaderId: string
): void {
  const timeout = setTimeout(async () => {
    logger.info(`[LobbyCleanup] Grace period expired for player ${playerId.substring(0, 8)} in lobby ${lobbyId.substring(0, 8)}, proceeding with cleanup`);
    await performPlayerCleanup(io, lobbyId, playerId, wasLeader, oldLeaderId);
  }, LOBBY_DISCONNECT_GRACE_PERIOD_MS);

  // Store the timeout
  if (!pendingLobbyDeletions.has(lobbyId)) {
    pendingLobbyDeletions.set(lobbyId, new Map());
  }
  pendingLobbyDeletions.get(lobbyId)!.set(playerId, timeout);

  logger.info(`[LobbyCleanup] Scheduled cleanup for player ${playerId.substring(0, 8)} from lobby ${lobbyId.substring(0, 8)} in ${LOBBY_DISCONNECT_GRACE_PERIOD_MS / 1000} seconds`);
}
