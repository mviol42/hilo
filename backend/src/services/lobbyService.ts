/**
 * Lobby management service
 */

import { v4 as uuidv4 } from 'uuid';
import { Lobby, LobbyId, LobbyState, LobbyStatus } from '@hilo/shared';
import { Player, PlayerId } from '@hilo/shared';
import { LOBBY_CLEANUP_INTERVAL, LOBBY_TIMEOUT } from '../config/constants';

export class LobbyService {
  private lobbies: Map<LobbyId, Lobby> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Create a new lobby
   * @returns The newly created lobby
   */
  createLobby(): Lobby {
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

    this.lobbies.set(lobbyId, lobby);
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
  joinLobby(lobbyId: LobbyId, playerId: PlayerId, playerName?: string): Player {
    const lobby = this.lobbies.get(lobbyId);

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

    return player;
  }

  /**
   * Get lobby by ID
   * @param lobbyId - The lobby ID
   * @returns The lobby or null if not found
   */
  getLobby(lobbyId: LobbyId): Lobby | null {
    return this.lobbies.get(lobbyId) || null;
  }

  /**
   * Get lobby state (serializable format for API responses)
   * @param lobbyId - The lobby ID
   * @returns The lobby state or null if not found
   */
  getLobbyState(lobbyId: LobbyId): LobbyState | null {
    const lobby = this.lobbies.get(lobbyId);

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
  canStartGame(lobbyId: LobbyId, playerId: PlayerId): boolean {
    const lobby = this.lobbies.get(lobbyId);

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
  readyPlayer(lobbyId: LobbyId, playerId: PlayerId): Player {
    const lobby = this.lobbies.get(lobbyId);

    if (!lobby) {
      throw new Error('Lobby not found');
    }

    var player = lobby.players.get(playerId);
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
    return player;
  }

  /**
   * Remove a player from a lobby
   * @param lobbyId - The lobby ID
   * @param playerId - The player ID
   * @throws Error if lobby or player not found
   */
  leaveLobby(lobbyId: LobbyId, playerId: PlayerId): void {
    const lobby = this.lobbies.get(lobbyId);

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
      this.lobbies.delete(lobbyId);
      return;
    }

    // If leader left, assign to next player
    if (wasLeader) {
      const nextPlayer = lobby.players.values().next().value;
      if (nextPlayer) {
        this.setLeader(lobbyId, nextPlayer.id);
      }
    }
  }

  /**
   * Set a new leader for the lobby
   * @param lobbyId - The lobby ID
   * @param playerId - The new leader's player ID
   * @throws Error if lobby or player not found
   */
  setLeader(lobbyId: LobbyId, playerId: PlayerId): void {
    const lobby = this.lobbies.get(lobbyId);

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
  }

  /**
   * Transition lobby to in-game status
   * @param lobbyId - The lobby ID
   */
  transitionToGame(lobbyId: LobbyId): void {
    const lobby = this.lobbies.get(lobbyId);

    if (!lobby) {
      throw new Error('Lobby not found');
    }

    lobby.status = 'in_game';
  }

  /**
   * Update socket ID for a player (for reconnection handling)
   * @param lobbyId - The lobby ID
   * @param playerId - The player ID
   * @param socketId - The socket ID
   * @throws Error if lobby or player not found
   */
  updateSocketId(lobbyId: LobbyId, playerId: PlayerId, socketId: string): void {
    const lobby = this.lobbies.get(lobbyId);

    if (!lobby) {
      throw new Error('Lobby not found');
    }

    const player = lobby.players.get(playerId);
    if (!player) {
      throw new Error('Player not found in lobby');
    }

    player.socketId = socketId;
  }

  /**
   * Remove a lobby
   * @param lobbyId - The lobby ID
   */
  removeLobby(lobbyId: LobbyId): void {
    this.lobbies.delete(lobbyId);
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
  cleanupStaleLobbies(): number {
    const now = new Date();
    let removed = 0;

    for (const [lobbyId, lobby] of this.lobbies.entries()) {
      const timeSinceActivity = now.getTime() - lobby.lastActivityAt.getTime();

      if (timeSinceActivity > LOBBY_TIMEOUT) {
        this.lobbies.delete(lobbyId);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Clear all lobbies (for testing)
   */
  clearAll(): void {
    this.lobbies.clear();
  }
}

// Singleton instance
export const lobbyService = new LobbyService();
