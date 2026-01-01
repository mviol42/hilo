/**
 * Unit tests for GameHeartbeatManager
 *
 * Tests the heartbeat manager that periodically broadcasts game state to connected players.
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';

describe('GameHeartbeatManager', () => {
  let GameHeartbeatManager: any;
  let gameHeartbeatManager: any;
  let mockIo: any;
  let mockGameService: any;

  beforeAll(async () => {
    // Mock gameService before importing gameHeartbeat
    vi.doMock('../../../src/services/gameService', () => ({
      gameService: {
        getGame: vi.fn(),
        getPlayerView: vi.fn(),
      },
    }));
  });

  beforeEach(async () => {
    vi.useFakeTimers();

    // Reset module cache to get fresh instance
    vi.resetModules();

    // Re-apply mocks after reset
    vi.doMock('../../../src/services/gameService', () => ({
      gameService: {
        getGame: vi.fn(),
        getPlayerView: vi.fn(),
      },
    }));

    // Import gameService mock
    const gameServiceModule = await import('../../../src/services/gameService');
    mockGameService = gameServiceModule.gameService;

    // Import the manager class
    const module = await import('../../../src/services/gameHeartbeat');
    GameHeartbeatManager = module.GameHeartbeatManager;

    // Create a fresh instance for each test
    gameHeartbeatManager = new GameHeartbeatManager();

    // Create mock Socket.IO server
    mockIo = {
      in: vi.fn().mockReturnThis(),
      fetchSockets: vi.fn().mockResolvedValue([]),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('initialize', () => {
    it('should store the io instance', () => {
      gameHeartbeatManager.initialize(mockIo);
      // No public getter, but we can verify it works by starting a heartbeat
      expect(() => {
        gameHeartbeatManager.startHeartbeat('game-1', 'room-1', ['player-1']);
      }).not.toThrow();
    });
  });

  describe('startHeartbeat', () => {
    it('should not start heartbeat if not initialized', () => {
      gameHeartbeatManager.startHeartbeat('game-1', 'room-1', ['player-1']);
      expect(gameHeartbeatManager.getActiveHeartbeatCount()).toBe(0);
    });

    it('should start heartbeat when initialized', () => {
      gameHeartbeatManager.initialize(mockIo);
      gameHeartbeatManager.startHeartbeat('game-1', 'room-1', ['player-1']);
      expect(gameHeartbeatManager.getActiveHeartbeatCount()).toBe(1);
    });

    it('should stop existing heartbeat before starting new one', () => {
      gameHeartbeatManager.initialize(mockIo);
      gameHeartbeatManager.startHeartbeat('game-1', 'room-1', ['player-1']);
      gameHeartbeatManager.startHeartbeat('game-1', 'room-1', ['player-1', 'player-2']);
      expect(gameHeartbeatManager.getActiveHeartbeatCount()).toBe(1);
    });

    it('should track multiple game heartbeats', () => {
      gameHeartbeatManager.initialize(mockIo);
      gameHeartbeatManager.startHeartbeat('game-1', 'room-1', ['player-1']);
      gameHeartbeatManager.startHeartbeat('game-2', 'room-2', ['player-2']);
      expect(gameHeartbeatManager.getActiveHeartbeatCount()).toBe(2);
    });
  });

  describe('stopHeartbeat', () => {
    it('should stop and remove heartbeat', () => {
      gameHeartbeatManager.initialize(mockIo);
      gameHeartbeatManager.startHeartbeat('game-1', 'room-1', ['player-1']);
      expect(gameHeartbeatManager.getActiveHeartbeatCount()).toBe(1);

      gameHeartbeatManager.stopHeartbeat('game-1');
      expect(gameHeartbeatManager.getActiveHeartbeatCount()).toBe(0);
    });

    it('should not throw for non-existent game', () => {
      gameHeartbeatManager.initialize(mockIo);
      expect(() => {
        gameHeartbeatManager.stopHeartbeat('non-existent');
      }).not.toThrow();
    });
  });

  describe('heartbeat broadcast', () => {
    it('should broadcast state every 5 seconds', async () => {
      gameHeartbeatManager.initialize(mockIo);

      // Setup mock game
      mockGameService.getGame.mockResolvedValue({
        id: 'game-1',
        phase: 'playing',
        stateVersion: 1,
      });

      // Setup mock socket
      const mockSocket = {
        data: { playerId: 'player-1' },
        emit: vi.fn(),
      };
      mockIo.fetchSockets.mockResolvedValue([mockSocket]);

      mockGameService.getPlayerView.mockResolvedValue({
        id: 'game-1',
        phase: 'playing',
        stateVersion: 1,
      });

      gameHeartbeatManager.startHeartbeat('game-1', 'room-1', ['player-1']);

      // Initially no broadcasts
      expect(mockGameService.getGame).not.toHaveBeenCalled();

      // Advance 5 seconds
      await vi.advanceTimersByTimeAsync(5000);

      // Should have called getGame
      expect(mockGameService.getGame).toHaveBeenCalledWith('game-1');
    });

    it('should stop heartbeat when game ends', async () => {
      gameHeartbeatManager.initialize(mockIo);

      // Setup mock game as ended
      mockGameService.getGame.mockResolvedValue({
        id: 'game-1',
        phase: 'ended',
        stateVersion: 10,
      });

      gameHeartbeatManager.startHeartbeat('game-1', 'room-1', ['player-1']);
      expect(gameHeartbeatManager.getActiveHeartbeatCount()).toBe(1);

      // Advance 5 seconds to trigger first heartbeat
      await vi.advanceTimersByTimeAsync(5000);

      // Heartbeat should be stopped since game ended
      expect(gameHeartbeatManager.getActiveHeartbeatCount()).toBe(0);
    });

    it('should stop heartbeat when game no longer exists', async () => {
      gameHeartbeatManager.initialize(mockIo);

      // Setup mock game as not found
      mockGameService.getGame.mockResolvedValue(null);

      gameHeartbeatManager.startHeartbeat('game-1', 'room-1', ['player-1']);
      expect(gameHeartbeatManager.getActiveHeartbeatCount()).toBe(1);

      // Advance 5 seconds
      await vi.advanceTimersByTimeAsync(5000);

      // Heartbeat should be stopped
      expect(gameHeartbeatManager.getActiveHeartbeatCount()).toBe(0);
    });

    it('should skip broadcast when no sockets connected', async () => {
      gameHeartbeatManager.initialize(mockIo);

      mockGameService.getGame.mockResolvedValue({
        id: 'game-1',
        phase: 'playing',
        stateVersion: 1,
      });

      // No sockets connected
      mockIo.fetchSockets.mockResolvedValue([]);

      gameHeartbeatManager.startHeartbeat('game-1', 'room-1', ['player-1']);

      // Advance 5 seconds
      await vi.advanceTimersByTimeAsync(5000);

      // Should not call getPlayerView since no sockets
      expect(mockGameService.getPlayerView).not.toHaveBeenCalled();

      // Heartbeat should still be active (waiting for reconnection)
      expect(gameHeartbeatManager.getActiveHeartbeatCount()).toBe(1);
    });

    it('should send personalized view to each player', async () => {
      gameHeartbeatManager.initialize(mockIo);

      mockGameService.getGame.mockResolvedValue({
        id: 'game-1',
        phase: 'playing',
        stateVersion: 5,
      });

      const mockSocket1 = {
        data: { playerId: 'player-1' },
        emit: vi.fn(),
      };
      const mockSocket2 = {
        data: { playerId: 'player-2' },
        emit: vi.fn(),
      };
      mockIo.fetchSockets.mockResolvedValue([mockSocket1, mockSocket2]);

      const player1View = { id: 'game-1', phase: 'playing', myHand: ['card1'], stateVersion: 5 };
      const player2View = { id: 'game-1', phase: 'playing', myHand: ['card2'], stateVersion: 5 };

      mockGameService.getPlayerView
        .mockResolvedValueOnce(player1View)
        .mockResolvedValueOnce(player2View);

      gameHeartbeatManager.startHeartbeat('game-1', 'room-1', ['player-1', 'player-2']);

      // Advance 5 seconds
      await vi.advanceTimersByTimeAsync(5000);

      // Each player should get their personalized view
      expect(mockSocket1.emit).toHaveBeenCalledWith('game:stateUpdate', { gameState: player1View });
      expect(mockSocket2.emit).toHaveBeenCalledWith('game:stateUpdate', { gameState: player2View });
    });
  });

  describe('getActiveHeartbeatCount', () => {
    it('should return 0 when no heartbeats', () => {
      expect(gameHeartbeatManager.getActiveHeartbeatCount()).toBe(0);
    });

    it('should return correct count', () => {
      gameHeartbeatManager.initialize(mockIo);
      gameHeartbeatManager.startHeartbeat('game-1', 'room-1', ['player-1']);
      gameHeartbeatManager.startHeartbeat('game-2', 'room-2', ['player-2']);
      gameHeartbeatManager.startHeartbeat('game-3', 'room-3', ['player-3']);

      expect(gameHeartbeatManager.getActiveHeartbeatCount()).toBe(3);

      gameHeartbeatManager.stopHeartbeat('game-2');
      expect(gameHeartbeatManager.getActiveHeartbeatCount()).toBe(2);
    });
  });
});
