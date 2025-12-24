/**
 * Lobby management service
 */

import { v4 as uuidv4 } from 'uuid';
import { Lobby, LobbyId, LobbyState, LobbyStatus } from '@hilo/shared';
import { Player, PlayerId } from '@hilo/shared';

export class LobbyService {
  private lobbies: Map<LobbyId, Lobby> = new Map();

  /**
   * Create a new lobby
   * @returns The newly created lobby
   */
  createLobby(): Lobby {
    const lobbyId = uuidv4();
    const lobby: Lobby = {
      id: lobbyId,
      players: new Map(),
      leaderId: '',
      status: 'waiting' as LobbyStatus,
      createdAt: new Date(),
    };

    this.lobbies.set(lobbyId, lobby);
    return lobby;
  }

  /**
   * Join an existing lobby
   * @param lobbyId - The lobby to join
   * @param playerName - Optional player name
   * @returns The player that joined
   * @throws Error if lobby doesn't exist or is in-game
   */
  joinLobby(lobbyId: LobbyId, playerName?: string): Player {
    const lobby = this.lobbies.get(lobbyId);

    if (!lobby) {
      throw new Error('Lobby not found');
    }

    if (lobby.status === 'in_game') {
      throw new Error('Lobby is already in game');
    }

    const playerId = uuidv4();
    const isFirstPlayer = lobby.players.size === 0;

    const player: Player = {
      id: playerId,
      name: playerName || `Player ${lobby.players.size + 1}`,
      isLeader: isFirstPlayer,
    };

    lobby.players.set(playerId, player);

    // Set leader if first player
    if (isFirstPlayer) {
      lobby.leaderId = playerId;
    }

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

    return true;
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
   * Remove a lobby
   * @param lobbyId - The lobby ID
   */
  removeLobby(lobbyId: LobbyId): void {
    this.lobbies.delete(lobbyId);
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
