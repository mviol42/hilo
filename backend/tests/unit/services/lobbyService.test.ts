/**
 * Unit tests for LobbyService
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LobbyService } from '../../../src/services/lobbyService';

describe('LobbyService', () => {
  let service: LobbyService;

  beforeEach(() => {
    service = new LobbyService();
  });

  describe('createLobby', () => {
    it('should create a new lobby with UUID', () => {
      const lobby = service.createLobby();

      expect(lobby).toBeDefined();
      expect(lobby.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(lobby.players.size).toBe(0);
      expect(lobby.status).toBe('waiting');
      expect(lobby.createdAt).toBeInstanceOf(Date);
    });

    it('should create lobbies with unique IDs', () => {
      const lobby1 = service.createLobby();
      const lobby2 = service.createLobby();

      expect(lobby1.id).not.toBe(lobby2.id);
    });

    it('should make lobby retrievable by ID', () => {
      const lobby = service.createLobby();
      const retrieved = service.getLobby(lobby.id);

      expect(retrieved).toBe(lobby);
    });
  });

  describe('joinLobby', () => {
    it('should add player to lobby', () => {
      const lobby = service.createLobby();
      const player = service.joinLobby(lobby.id, 'Alice');

      expect(player).toBeDefined();
      expect(player.name).toBe('Alice');
      expect(player.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should make first player the leader', () => {
      const lobby = service.createLobby();
      const player = service.joinLobby(lobby.id, 'Alice');

      expect(player.isLeader).toBe(true);
      expect(lobby.leaderId).toBe(player.id);
    });

    it('should not make second player the leader', () => {
      const lobby = service.createLobby();
      service.joinLobby(lobby.id, 'Alice');
      const player2 = service.joinLobby(lobby.id, 'Bob');

      expect(player2.isLeader).toBe(false);
    });

    it('should use default name if not provided', () => {
      const lobby = service.createLobby();
      const player1 = service.joinLobby(lobby.id);
      const player2 = service.joinLobby(lobby.id);

      expect(player1.name).toBe('Player 1');
      expect(player2.name).toBe('Player 2');
    });

    it('should throw error for non-existent lobby', () => {
      expect(() => {
        service.joinLobby('non-existent-id', 'Alice');
      }).toThrow('Lobby not found');
    });

    it('should throw error for lobby already in game', () => {
      const lobby = service.createLobby();
      service.joinLobby(lobby.id, 'Alice');
      service.joinLobby(lobby.id, 'Bob');
      service.transitionToGame(lobby.id);

      expect(() => {
        service.joinLobby(lobby.id, 'Charlie');
      }).toThrow('Lobby is already in game');
    });
  });

  describe('getLobby', () => {
    it('should return lobby by ID', () => {
      const lobby = service.createLobby();
      const retrieved = service.getLobby(lobby.id);

      expect(retrieved).toBe(lobby);
    });

    it('should return null for non-existent lobby', () => {
      const retrieved = service.getLobby('non-existent-id');

      expect(retrieved).toBeNull();
    });
  });

  describe('getLobbyState', () => {
    it('should return serializable lobby state', () => {
      const lobby = service.createLobby();
      const player1 = service.joinLobby(lobby.id, 'Alice');
      const player2 = service.joinLobby(lobby.id, 'Bob');

      const state = service.getLobbyState(lobby.id);

      expect(state).toBeDefined();
      expect(state?.id).toBe(lobby.id);
      expect(state?.players).toHaveLength(2);
      expect(state?.players[0].name).toBe('Alice');
      expect(state?.players[1].name).toBe('Bob');
      expect(state?.leaderId).toBe(player1.id);
      expect(state?.status).toBe('waiting');
    });

    it('should return null for non-existent lobby', () => {
      const state = service.getLobbyState('non-existent-id');

      expect(state).toBeNull();
    });
  });

  describe('canStartGame', () => {
    it('should return true when leader with 2+ players', () => {
      const lobby = service.createLobby();
      const leader = service.joinLobby(lobby.id, 'Alice');
      service.joinLobby(lobby.id, 'Bob');

      expect(service.canStartGame(lobby.id, leader.id)).toBe(true);
    });

    it('should throw error for non-existent lobby', () => {
      expect(() => {
        service.canStartGame('non-existent-id', 'player-id');
      }).toThrow('Lobby not found');
    });

    it('should throw error for non-leader', () => {
      const lobby = service.createLobby();
      service.joinLobby(lobby.id, 'Alice');
      const player2 = service.joinLobby(lobby.id, 'Bob');

      expect(() => {
        service.canStartGame(lobby.id, player2.id);
      }).toThrow('Only the leader can start the game');
    });

    it('should throw error with less than 2 players', () => {
      const lobby = service.createLobby();
      const leader = service.joinLobby(lobby.id, 'Alice');

      expect(() => {
        service.canStartGame(lobby.id, leader.id);
      }).toThrow('Need at least 2 players to start');
    });

    it('should throw error if game already started', () => {
      const lobby = service.createLobby();
      const leader = service.joinLobby(lobby.id, 'Alice');
      service.joinLobby(lobby.id, 'Bob');
      service.transitionToGame(lobby.id);

      expect(() => {
        service.canStartGame(lobby.id, leader.id);
      }).toThrow('Game already started');
    });
  });

  describe('transitionToGame', () => {
    it('should change lobby status to in_game', () => {
      const lobby = service.createLobby();
      service.joinLobby(lobby.id, 'Alice');
      service.joinLobby(lobby.id, 'Bob');

      service.transitionToGame(lobby.id);

      expect(lobby.status).toBe('in_game');
    });

    it('should throw error for non-existent lobby', () => {
      expect(() => {
        service.transitionToGame('non-existent-id');
      }).toThrow('Lobby not found');
    });
  });

  describe('removeLobby', () => {
    it('should remove lobby from storage', () => {
      const lobby = service.createLobby();
      service.removeLobby(lobby.id);

      expect(service.getLobby(lobby.id)).toBeNull();
    });

    it('should not throw error for non-existent lobby', () => {
      expect(() => {
        service.removeLobby('non-existent-id');
      }).not.toThrow();
    });
  });

  describe('clearAll', () => {
    it('should remove all lobbies', () => {
      const lobby1 = service.createLobby();
      const lobby2 = service.createLobby();

      service.clearAll();

      expect(service.getLobby(lobby1.id)).toBeNull();
      expect(service.getLobby(lobby2.id)).toBeNull();
    });
  });
});
