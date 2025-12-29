/**
 * Unit tests for LobbyService
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { setupGlobalMockRedis, resetMockRedis } from '../../testUtils/redisSetup';

describe('LobbyService', () => {
  let service: any;
  let redisService: any;

  beforeAll(async () => {
    // Set up redis-mock globally before importing services
    await setupGlobalMockRedis();

    // Import services after redis is mocked
    const lobbyServiceModule = await import('../../../src/services/lobbyService');
    const redisServiceModule = await import('../../../src/services/redisService');

    service = new lobbyServiceModule.LobbyService();
    redisService = redisServiceModule.redisService;
  });

  beforeEach(async () => {
    // Reset redis data between tests
    await resetMockRedis(redisService);
  });

  describe('createLobby', () => {
    it('should create a new lobby with UUID', async () => {
      const lobby = await service.createLobby();

      expect(lobby).toBeDefined();
      expect(lobby.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(lobby.players.size).toBe(0);
      expect(lobby.status).toBe('waiting');
      expect(lobby.createdAt).toBeInstanceOf(Date);
    });

    it('should create lobbies with unique IDs', async () => {
      const lobby1 = await service.createLobby();
      const lobby2 = await service.createLobby();

      expect(lobby1.id).not.toBe(lobby2.id);
    });

    it('should make lobby retrievable by ID', async () => {
      const lobby = await service.createLobby();
      const retrieved = await service.getLobby(lobby.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(lobby.id);
    });
  });

  describe('joinLobby', () => {
    it('should add player to lobby', async () => {
      const lobby = await service.createLobby();
      const player = await service.joinLobby(lobby.id, uuidv4(), 'Alice');

      expect(player).toBeDefined();
      expect(player.name).toBe('Alice');
      expect(player.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should make first player the leader', async () => {
      const lobby = await service.createLobby();
      const player = await service.joinLobby(lobby.id, uuidv4(), 'Alice');

      expect(player.isLeader).toBe(true);

      // Verify in retrieved lobby since we're using Redis
      const retrievedLobby = await service.getLobby(lobby.id);
      expect(retrievedLobby?.leaderId).toBe(player.id);
    });

    it('should not make second player the leader', async () => {
      const lobby = await service.createLobby();
      await service.joinLobby(lobby.id, uuidv4(), 'Alice');
      const player2 = await service.joinLobby(lobby.id, uuidv4(), 'Bob');

      expect(player2.isLeader).toBe(false);
    });

    it('should use default name if not provided', async () => {
      const lobby = await service.createLobby();
      const player1 = await service.joinLobby(lobby.id, uuidv4());
      const player2 = await service.joinLobby(lobby.id, uuidv4());

      expect(player1.name).toBe('Player 1');
      expect(player2.name).toBe('Player 2');
    });

    it('should throw error for non-existent lobby', async () => {
      await expect(async () => {
        await service.joinLobby('non-existent-id', uuidv4(), 'Alice');
      }).rejects.toThrow('Lobby not found');
    });

    it('should throw error for lobby already in game', async () => {
      const lobby = await service.createLobby();
      await service.joinLobby(lobby.id, uuidv4(), 'Alice');
      await service.joinLobby(lobby.id, uuidv4(), 'Bob');
      await service.transitionToGame(lobby.id);

      await expect(async () => {
        await service.joinLobby(lobby.id, uuidv4(), 'Charlie');
      }).rejects.toThrow('Lobby is already in game');
    });

    it('should throw error for duplicate player ID', async () => {
      const lobby = await service.createLobby();
      const playerId = uuidv4();
      await service.joinLobby(lobby.id, playerId, 'Alice');

      await expect(async () => {
        await service.joinLobby(lobby.id, playerId, 'Bob');
      }).rejects.toThrow('Player ID already exists in this lobby');
    });
  });

  describe('getLobby', () => {
    it('should return lobby by ID', async () => {
      const lobby = await service.createLobby();
      const retrieved = await service.getLobby(lobby.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(lobby.id);
    });

    it('should return null for non-existent lobby', async () => {
      const retrieved = await service.getLobby('non-existent-id');

      expect(retrieved).toBeNull();
    });
  });

  describe('getLobbyState', () => {
    it('should return serializable lobby state', async () => {
      const lobby = await service.createLobby();
      const player1 = await service.joinLobby(lobby.id, uuidv4(), 'Alice');
      const player2 = await service.joinLobby(lobby.id, uuidv4(), 'Bob');

      const state = await service.getLobbyState(lobby.id);

      expect(state).toBeDefined();
      expect(state?.id).toBe(lobby.id);
      expect(state?.players).toHaveLength(2);
      expect(state?.players[0].name).toBe('Alice');
      expect(state?.players[1].name).toBe('Bob');
      expect(state?.leaderId).toBe(player1.id);
      expect(state?.status).toBe('waiting');
    });

    it('should return null for non-existent lobby', async () => {
      const state = await service.getLobbyState('non-existent-id');

      expect(state).toBeNull();
    });
  });

  describe('canStartGame', () => {
    it('should return true when leader with 2+ players', async () => {
      const lobby = await service.createLobby();
      const leader = await service.joinLobby(lobby.id, uuidv4(), 'Alice');
      const player2 = await service.joinLobby(lobby.id, uuidv4(), 'Bob');

      // Player 2 needs to be ready
      await service.readyPlayer(lobby.id, player2.id);

      const result = await service.canStartGame(lobby.id, leader.id);
      expect(result).toBe(true);
    });

    it('should throw error for non-existent lobby', async () => {
      await expect(async () => {
        await service.canStartGame('non-existent-id', 'player-id');
      }).rejects.toThrow('Lobby not found');
    });

    it('should throw error for non-leader', async () => {
      const lobby = await service.createLobby();
      await service.joinLobby(lobby.id, uuidv4(), 'Alice');
      const player2 = await service.joinLobby(lobby.id, uuidv4(), 'Bob');

      await expect(async () => {
        await service.canStartGame(lobby.id, player2.id);
      }).rejects.toThrow('Only the leader can start the game');
    });

    it('should throw error with less than 2 players', async () => {
      const lobby = await service.createLobby();
      const leader = await service.joinLobby(lobby.id, uuidv4(), 'Alice');

      await expect(async () => {
        await service.canStartGame(lobby.id, leader.id);
      }).rejects.toThrow('Need at least 2 players to start');
    });

    it('should throw error if game already started', async () => {
      const lobby = await service.createLobby();
      const leader = await service.joinLobby(lobby.id, uuidv4(), 'Alice');
      await service.joinLobby(lobby.id, uuidv4(), 'Bob');
      await service.transitionToGame(lobby.id);

      await expect(async () => {
        await service.canStartGame(lobby.id, leader.id);
      }).rejects.toThrow('Game already started');
    });
  });

  describe('transitionToGame', () => {
    it('should change lobby status to in_game', async () => {
      const lobby = await service.createLobby();
      await service.joinLobby(lobby.id, uuidv4(), 'Alice');
      await service.joinLobby(lobby.id, uuidv4(), 'Bob');

      await service.transitionToGame(lobby.id);

      const updatedLobby = await service.getLobby(lobby.id);
      expect(updatedLobby?.status).toBe('in_game');
    });

    it('should throw error for non-existent lobby', async () => {
      await expect(async () => {
        await service.transitionToGame('non-existent-id');
      }).rejects.toThrow('Lobby not found');
    });
  });

  describe('removeLobby', () => {
    it('should remove lobby from storage', async () => {
      const lobby = await service.createLobby();
      await service.removeLobby(lobby.id);

      const retrieved = await service.getLobby(lobby.id);
      expect(retrieved).toBeNull();
    });

    it('should not throw error for non-existent lobby', async () => {
      // This should not throw
      await service.removeLobby('non-existent-id');
      // If we get here without error, test passes
      expect(true).toBe(true);
    });
  });

  describe('clearAll', () => {
    it('should be a no-op (redis data persists)', async () => {
      const lobby1 = await service.createLobby();
      const lobby2 = await service.createLobby();

      await service.clearAll();

      // Since clearAll() is a no-op with Redis, lobbies should still exist
      const retrieved1 = await service.getLobby(lobby1.id);
      const retrieved2 = await service.getLobby(lobby2.id);
      expect(retrieved1).toBeDefined();
      expect(retrieved2).toBeDefined();

      // To actually clear, use resetMockRedis in beforeEach
    });
  });
});
