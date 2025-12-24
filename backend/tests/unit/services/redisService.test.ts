/**
 * Unit tests for RedisService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RedisService, PlayerSession } from '../../../src/services/redisService';
import { GameState, GameLogEntry, GamePhase } from '@hilo/shared';
import { Lobby } from '@hilo/shared';
import { Card } from '@hilo/shared';

// Shared storage for mock Redis client (reset between tests)
let mockStore = new Map<string, string>();
let mockLists = new Map<string, string[]>();

// Create a mock Redis client
const createMockRedisClient = () => {
  const eventHandlers: { [key: string]: ((...args: unknown[]) => void)[] } = {};

  return {
    isOpen: true,
    connect: vi.fn().mockImplementation(async () => {
      // Trigger 'connect' event after connection
      if (eventHandlers['connect']) {
        eventHandlers['connect'].forEach(handler => handler());
      }
      return undefined;
    }),
    quit: vi.fn().mockResolvedValue(undefined),
    on: vi.fn().mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      if (!eventHandlers[event]) {
        eventHandlers[event] = [];
      }
      eventHandlers[event].push(handler);
    }),
    set: vi.fn().mockImplementation(async (key: string, value: string) => {
      mockStore.set(key, value);
      return 'OK';
    }),
    setEx: vi.fn().mockImplementation(async (key: string, ttl: number, value: string) => {
      mockStore.set(key, value);
      return 'OK';
    }),
    get: vi.fn().mockImplementation(async (key: string) => {
      return mockStore.get(key) || null;
    }),
    del: vi.fn().mockImplementation(async (key: string) => {
      mockStore.delete(key);
      return 1;
    }),
    rPush: vi.fn().mockImplementation(async (key: string, value: string) => {
      if (!mockLists.has(key)) {
        mockLists.set(key, []);
      }
      mockLists.get(key)!.push(value);
      return mockLists.get(key)!.length;
    }),
    lRange: vi.fn().mockImplementation(async (key: string, start: number, end: number) => {
      const list = mockLists.get(key) || [];
      if (end === -1) return list;
      return list.slice(start, end + 1);
    }),
    expire: vi.fn().mockResolvedValue(1),
  };
};

// Mock the redis module
vi.mock('redis', () => ({
  createClient: () => createMockRedisClient(),
}));

// Mock constants to enable Redis in tests
vi.mock('../../../src/config/constants', async () => {
  const actual = await vi.importActual('../../../src/config/constants');
  return {
    ...actual,
    REDIS_ENABLED: true,
    REDIS_TTL_ACTIVE_GAME: 0,
    REDIS_TTL_COMPLETED_GAME: 86400,
    REDIS_TTL_LOBBY: 7200,
    REDIS_TTL_SESSION: 86400,
  };
});

describe('RedisService', () => {
  let service: RedisService;

  beforeEach(async () => {
    // Reset mock storage between tests
    mockStore = new Map<string, string>();
    mockLists = new Map<string, string[]>();

    service = new RedisService();
    await service.connect();
  });

  afterEach(async () => {
    await service.disconnect();
  });

  describe('connect', () => {
    it('should connect successfully', async () => {
      const newService = new RedisService();
      await newService.connect();

      expect(newService.isAvailable()).toBe(true);

      await newService.disconnect();
    });
  });

  describe('saveGameState and getGameState', () => {
    it('should save and retrieve game state', async () => {
      const gameState: GameState = {
        id: 'game-123',
        phase: 'playing' as GamePhase,
        players: new Map([
          ['player1', {
            hand: [{ suit: 'hearts', rank: '7' }] as Card[],
            faceUp: [],
            faceDown: [],
          }],
        ]),
        deck: [{ suit: 'spades', rank: 'A' }] as Card[],
        pile: [{ suit: 'clubs', rank: 'K' }] as Card[],
        discardPile: [],
        activePlayerId: 'player1',
        turnOrder: ['player1', 'player2'],
        log: [],
      };

      await service.saveGameState(gameState);
      const retrieved = await service.getGameState('game-123');

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe('game-123');
      expect(retrieved!.phase).toBe('playing');
      expect(retrieved!.activePlayerId).toBe('player1');
      expect(retrieved!.turnOrder).toEqual(['player1', 'player2']);
    });

    it('should preserve player Map structure', async () => {
      const gameState: GameState = {
        id: 'game-456',
        phase: 'setup' as GamePhase,
        players: new Map([
          ['player1', { hand: [], faceUp: [], faceDown: [] }],
          ['player2', { hand: [], faceUp: [], faceDown: [] }],
        ]),
        deck: [],
        pile: [],
        discardPile: [],
        activePlayerId: 'player1',
        turnOrder: ['player1', 'player2'],
        log: [],
      };

      await service.saveGameState(gameState);
      const retrieved = await service.getGameState('game-456');

      expect(retrieved!.players).toBeInstanceOf(Map);
      expect(retrieved!.players.size).toBe(2);
      expect(retrieved!.players.has('player1')).toBe(true);
      expect(retrieved!.players.has('player2')).toBe(true);
    });

    it('should return null for non-existent game', async () => {
      const retrieved = await service.getGameState('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should handle game state with winner', async () => {
      const gameState: GameState = {
        id: 'game-789',
        phase: 'ended' as GamePhase,
        players: new Map(),
        deck: [],
        pile: [],
        discardPile: [],
        activePlayerId: 'player1',
        turnOrder: ['player1'],
        log: [],
        winner: 'player1',
      };

      await service.saveGameState(gameState);
      const retrieved = await service.getGameState('game-789');

      expect(retrieved!.winner).toBe('player1');
      expect(retrieved!.phase).toBe('ended');
    });
  });

  describe('logGameAction and getGameLog', () => {
    it('should log game actions', async () => {
      const logEntry: GameLogEntry = {
        timestamp: new Date('2024-01-01T12:00:00Z'),
        playerId: 'player1',
        action: 'play_cards',
        cards: [{ suit: 'hearts', rank: '7' }] as Card[],
        description: 'Player 1 played 7 of hearts',
      };

      await service.logGameAction('game-123', logEntry);
      const log = await service.getGameLog('game-123');

      expect(log).toHaveLength(1);
      expect(log[0].playerId).toBe('player1');
      expect(log[0].action).toBe('play_cards');
      expect(log[0].description).toBe('Player 1 played 7 of hearts');
    });

    it('should preserve timestamp as Date object', async () => {
      const timestamp = new Date('2024-01-01T12:00:00Z');
      const logEntry: GameLogEntry = {
        timestamp,
        playerId: 'player1',
        action: 'pickup_pile',
        description: 'Player 1 picked up the pile',
      };

      await service.logGameAction('game-456', logEntry);
      const log = await service.getGameLog('game-456');

      expect(log[0].timestamp).toBeInstanceOf(Date);
      expect(log[0].timestamp.toISOString()).toBe(timestamp.toISOString());
    });

    it('should append multiple actions in order', async () => {
      const entry1: GameLogEntry = {
        timestamp: new Date('2024-01-01T12:00:00Z'),
        playerId: 'player1',
        action: 'play_cards',
        description: 'First action',
      };

      const entry2: GameLogEntry = {
        timestamp: new Date('2024-01-01T12:01:00Z'),
        playerId: 'player2',
        action: 'pickup_pile',
        description: 'Second action',
      };

      const entry3: GameLogEntry = {
        timestamp: new Date('2024-01-01T12:02:00Z'),
        playerId: 'player1',
        action: 'play_cards',
        description: 'Third action',
      };

      await service.logGameAction('game-789', entry1);
      await service.logGameAction('game-789', entry2);
      await service.logGameAction('game-789', entry3);

      const log = await service.getGameLog('game-789');

      expect(log).toHaveLength(3);
      expect(log[0].description).toBe('First action');
      expect(log[1].description).toBe('Second action');
      expect(log[2].description).toBe('Third action');
    });

    it('should return empty array for non-existent log', async () => {
      const log = await service.getGameLog('non-existent');
      expect(log).toEqual([]);
    });
  });

  describe('saveLobby and getLobby', () => {
    it('should save and retrieve lobby', async () => {
      const lobby: Lobby = {
        id: 'lobby-123',
        players: new Map([
          ['player1', { id: 'player1', name: 'Alice', isLeader: true }],
        ]),
        leaderId: 'player1',
        status: 'waiting',
        createdAt: new Date('2024-01-01T12:00:00Z'),
        lastActivityAt: new Date('2024-01-01T12:05:00Z'),
      };

      await service.saveLobby(lobby);
      const retrieved = await service.getLobby('lobby-123');

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe('lobby-123');
      expect(retrieved!.leaderId).toBe('player1');
      expect(retrieved!.status).toBe('waiting');
    });

    it('should preserve player Map and Date objects', async () => {
      const createdAt = new Date('2024-01-01T12:00:00Z');
      const lastActivityAt = new Date('2024-01-01T12:05:00Z');

      const lobby: Lobby = {
        id: 'lobby-456',
        players: new Map([
          ['player1', { id: 'player1', name: 'Alice', isLeader: true }],
          ['player2', { id: 'player2', name: 'Bob', isLeader: false }],
        ]),
        leaderId: 'player1',
        status: 'in_game',
        createdAt,
        lastActivityAt,
      };

      await service.saveLobby(lobby);
      const retrieved = await service.getLobby('lobby-456');

      expect(retrieved!.players).toBeInstanceOf(Map);
      expect(retrieved!.players.size).toBe(2);
      expect(retrieved!.createdAt).toBeInstanceOf(Date);
      expect(retrieved!.lastActivityAt).toBeInstanceOf(Date);
      expect(retrieved!.createdAt.toISOString()).toBe(createdAt.toISOString());
    });

    it('should return null for non-existent lobby', async () => {
      const retrieved = await service.getLobby('non-existent');
      expect(retrieved).toBeNull();
    });
  });

  describe('setPlayerSession and getPlayerSession', () => {
    it('should save and retrieve player session', async () => {
      const session: PlayerSession = {
        playerId: 'player-123',
        lobbyId: 'lobby-456',
        gameId: 'game-789',
        socketId: 'socket-abc',
        lastActive: new Date('2024-01-01T12:00:00Z'),
      };

      await service.setPlayerSession(session);
      const retrieved = await service.getPlayerSession('player-123');

      expect(retrieved).toBeDefined();
      expect(retrieved!.playerId).toBe('player-123');
      expect(retrieved!.lobbyId).toBe('lobby-456');
      expect(retrieved!.gameId).toBe('game-789');
      expect(retrieved!.socketId).toBe('socket-abc');
    });

    it('should preserve Date object', async () => {
      const lastActive = new Date('2024-01-01T12:00:00Z');
      const session: PlayerSession = {
        playerId: 'player-456',
        lastActive,
      };

      await service.setPlayerSession(session);
      const retrieved = await service.getPlayerSession('player-456');

      expect(retrieved!.lastActive).toBeInstanceOf(Date);
      expect(retrieved!.lastActive.toISOString()).toBe(lastActive.toISOString());
    });

    it('should handle session without lobby or game', async () => {
      const session: PlayerSession = {
        playerId: 'player-789',
        socketId: 'socket-xyz',
        lastActive: new Date(),
      };

      await service.setPlayerSession(session);
      const retrieved = await service.getPlayerSession('player-789');

      expect(retrieved!.playerId).toBe('player-789');
      expect(retrieved!.lobbyId).toBeUndefined();
      expect(retrieved!.gameId).toBeUndefined();
      expect(retrieved!.socketId).toBe('socket-xyz');
    });

    it('should return null for non-existent session', async () => {
      const retrieved = await service.getPlayerSession('non-existent');
      expect(retrieved).toBeNull();
    });
  });

  describe('clearPlayerSession', () => {
    it('should clear player session', async () => {
      const session: PlayerSession = {
        playerId: 'player-123',
        lobbyId: 'lobby-456',
        lastActive: new Date(),
      };

      await service.setPlayerSession(session);
      let retrieved = await service.getPlayerSession('player-123');
      expect(retrieved).toBeDefined();

      await service.clearPlayerSession('player-123');
      retrieved = await service.getPlayerSession('player-123');
      expect(retrieved).toBeNull();
    });

    it('should not throw error for non-existent session', async () => {
      await expect(service.clearPlayerSession('non-existent')).resolves.not.toThrow();
    });
  });

  describe('isAvailable', () => {
    it('should return true when connected', () => {
      expect(service.isAvailable()).toBe(true);
    });

    it('should return false when disconnected', async () => {
      await service.disconnect();
      expect(service.isAvailable()).toBe(false);
    });
  });
});
