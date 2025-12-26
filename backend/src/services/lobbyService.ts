/**
 * Lobby management service
 */

import { v4 as uuidv4 } from 'uuid';
import { Lobby, LobbyId, LobbyState, LobbyStatus } from '@hilo/shared';
import { Player, PlayerId } from '@hilo/shared';
import { LOBBY_CLEANUP_INTERVAL } from '../config/constants';
import { redisService } from './redisService';

export class LobbyService {
  private cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Create a new lobby
   * @returns The newly created lobby
   */
  async createLobby(): Promise<Lobby> {
    const lobbyId = uuidv4();
    const now = new Date();
    const lobby: Lobby = {
      id: lobbyId,
      players: new Map(),
      leaderId: '',
      status: 'waiting' as LobbyStatus,
      createdAt: now,
      lastActivityAt: now,
    };

    await redisService.saveLobby(lobby);
    return lobby;
  }

  /**
   * Join an existing lobby
   * @param lobbyId - The lobby to join
   * @param playerId - The player ID (provided by client)
   * @param playerName - Optional player name
   * @returns The player that joined
   * @throws Error if lobby doesn't exist, is in-game, or playerId already exists
   */
  async joinLobby(lobbyId: LobbyId, playerId: PlayerId, playerName?: string): Promise<Player> {
    const lobby = await redisService.getLobby(lobbyId);

    if (!lobby) {
      throw new Error('Lobby not found');
    }

    if (lobby.status === 'in_game') {
      throw new Error('Lobby is already in game');
    }

    // Check if player ID already exists in this lobby
    if (lobby.players.has(playerId)) {
      throw new Error('Player ID already exists in this lobby');
    }

    const isFirstPlayer = lobby.players.size === 0;

    const player: Player = {
      id: playerId,
      name: playerName || `Player ${lobby.players.size + 1}`,
      isLeader: isFirstPlayer,
      // the first player starts ready - they will be the leader
      isReady: isFirstPlayer,
    };

    lobby.players.set(playerId, player);

    // Set leader if first player
    if (isFirstPlayer) {
      lobby.leaderId = playerId;
    }

    // Update activity timestamp
    lobby.lastActivityAt = new Date();

    // Save updated lobby to Redis
    await redisService.saveLobby(lobby);

    return player;
  }

  /**
   * Get lobby by ID
   * @param lobbyId - The lobby ID
   * @returns The lobby or null if not found
   */
  async getLobby(lobbyId: LobbyId): Promise<Lobby | null> {
    return await redisService.getLobby(lobbyId);
  }

  /**
   * Get lobby state (serializable format for API responses)
   * @param lobbyId - The lobby ID
   * @returns The lobby state or null if not found
   */
  async getLobbyState(lobbyId: LobbyId): Promise<LobbyState | null> {
    const lobby = await redisService.getLobby(lobbyId);

    if (!lobby) {
      return null;
    }

    return {
      id: lobby.id,
      players: Array.from(lobby.players.values()),
      leaderId: lobby.leaderId,
      status: lobby.status,
    };
  }

  /**
   * Check if a player can start a game
   * @param lobbyId - The lobby ID
   * @param playerId - The player ID
   * @returns true if the player can start the game
   * @throws Error with specific reason if cannot start
   */
  async canStartGame(lobbyId: LobbyId, playerId: PlayerId): Promise<boolean> {
    const lobby = await redisService.getLobby(lobbyId);

    if (!lobby) {
      throw new Error('Lobby not found');
    }

    if (lobby.leaderId !== playerId) {
      throw new Error('Only the leader can start the game');
    }

    if (lobby.players.size < 2) {
      throw new Error('Need at least 2 players to start');
    }

    if (lobby.status === 'in_game') {
      throw new Error('Game already started');
    }

    let readinessCheck = true;
    lobby.players.forEach(player => {
      readinessCheck = readinessCheck && player.isReady;
    });

    if (!readinessCheck) {
      throw new Error('Players are not ready');
    }

    return true;
  }

  /**
   * ready a player in a lobby
   * @param lobbyId - The lobby ID
   * @param playerId - The player ID
   * @throws Error if lobby or player not found
   */
  async readyPlayer(lobbyId: LobbyId, playerId: PlayerId): Promise<Player> {
    const lobby = await redisService.getLobby(lobbyId);

    if (!lobby) {
      throw new Error('Lobby not found');
    }

    const player = lobby.players.get(playerId);
    if (!player) {
      throw new Error('Player not found in lobby');
    }

    const isLeader = lobby.leaderId === playerId;

    if (isLeader) {
      throw new Error('Leaders cannot ready - they should start instead')
    }

    const isReady = true;
    player.isReady = isReady;

    lobby.players.set(playerId, player);

    // Save updated lobby to Redis
    await redisService.saveLobby(lobby);

    return player;
  }

  /**
   * Remove a player from a lobby
   * @param lobbyId - The lobby ID
   * @param playerId - The player ID
   * @throws Error if lobby or player not found
   */
  async leaveLobby(lobbyId: LobbyId, playerId: PlayerId): Promise<void> {
    const lobby = await redisService.getLobby(lobbyId);

    if (!lobby) {
      throw new Error('Lobby not found');
    }

    if (!lobby.players.has(playerId)) {
      throw new Error('Player not found in lobby');
    }

    const wasLeader = lobby.leaderId === playerId;
    lobby.players.delete(playerId);

    // If no players left, remove the lobby
    if (lobby.players.size === 0) {
      await redisService.deleteLobby(lobbyId);
      return;
    }

    // If leader left, assign to next player
    if (wasLeader) {
      const nextPlayer = lobby.players.values().next().value;
      if (nextPlayer) {
        lobby.leaderId = nextPlayer.id;
        nextPlayer.isLeader = true;
      }
    }

    // Save updated lobby to Redis
    await redisService.saveLobby(lobby);
  }

  /**
   * Set a new leader for the lobby
   * @param lobbyId - The lobby ID
   * @param playerId - The new leader's player ID
   * @throws Error if lobby or player not found
   */
  async setLeader(lobbyId: LobbyId, playerId: PlayerId): Promise<void> {
    const lobby = await redisService.getLobby(lobbyId);

    if (!lobby) {
      throw new Error('Lobby not found');
    }

    const player = lobby.players.get(playerId);
    if (!player) {
      throw new Error('Player not found in lobby');
    }

    // Remove leader status from old leader
    if (lobby.leaderId) {
      const oldLeader = lobby.players.get(lobby.leaderId);
      if (oldLeader) {
        oldLeader.isLeader = false;
      }
    }

    // Set new leader
    lobby.leaderId = playerId;
    player.isLeader = true;

    // Save updated lobby to Redis
    await redisService.saveLobby(lobby);
  }

  /**
   * Transition lobby to in-game status
   * @param lobbyId - The lobby ID
   */
  async transitionToGame(lobbyId: LobbyId): Promise<void> {
    const lobby = await redisService.getLobby(lobbyId);

    if (!lobby) {
      throw new Error('Lobby not found');
    }

    lobby.status = 'in_game';

    // Save updated lobby to Redis
    await redisService.saveLobby(lobby);
  }

  /**
   * Update socket ID for a player (for reconnection handling)
   * @param lobbyId - The lobby ID
   * @param playerId - The player ID
   * @param socketId - The socket ID
   * @throws Error if lobby or player not found
   */
  async updateSocketId(lobbyId: LobbyId, playerId: PlayerId, socketId: string): Promise<void> {
    const lobby = await redisService.getLobby(lobbyId);

    if (!lobby) {
      throw new Error('Lobby not found');
    }

    const player = lobby.players.get(playerId);
    if (!player) {
      throw new Error('Player not found in lobby');
    }

    player.socketId = socketId;

    // Save updated lobby to Redis
    await redisService.saveLobby(lobby);
  }

  /**
   * Remove a lobby
   * @param lobbyId - The lobby ID
   */
  async removeLobby(lobbyId: LobbyId): Promise<void> {
    await redisService.deleteLobby(lobbyId);
  }

  /**
   * Start the auto-cleanup timer for stale lobbies
   */
  startCleanup(): void {
    if (this.cleanupInterval) {
      return; // Already running
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleLobbies();
    }, LOBBY_CLEANUP_INTERVAL);
  }

  /**
   * Stop the auto-cleanup timer
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clean up stale lobbies that have been inactive for too long
   * @returns Number of lobbies removed
   */
  async cleanupStaleLobbies(): Promise<number> {
    // Note: This implementation requires scanning all lobby keys in Redis
    // For production, consider using Redis SCAN with pattern matching
    console.warn('[LobbyService] cleanupStaleLobbies() not fully implemented for Redis - requires key scanning');
    return 0;
  }

  /**
   * Clear all lobbies (for testing)
   */
  async clearAll(): Promise<void> {
    // Note: This will only clear lobbies from Redis if it's available
    // In tests with redis-mock, this should work fine
    // For production, you might want to implement a scan/delete pattern
    console.warn('[LobbyService] clearAll() does not delete Redis data - for testing with mock only');
  }
}

// Singleton instance
export const lobbyService = new LobbyService();
