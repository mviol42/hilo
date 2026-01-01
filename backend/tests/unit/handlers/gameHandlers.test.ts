/**
 * Unit tests for game Socket.IO handlers
 *
 * Tests the game:requestState handler for state recovery on reconnect
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Socket } from 'socket.io';

// Mock gameService
vi.mock('../../../src/services/gameService', () => ({
  gameService: {
    getPlayerView: vi.fn(),
  },
}));

describe('registerGameHandlers', () => {
  let registerGameHandlers: any;
  let mockSocket: any;
  let mockIo: any;
  let mockGameService: any;
  let gameRequestStateHandler: any;

  beforeEach(async () => {
    vi.resetModules();

    // Re-apply mocks after reset
    vi.doMock('../../../src/services/gameService', () => ({
      gameService: {
        getPlayerView: vi.fn(),
      },
    }));

    // Import modules
    const gameServiceModule = await import('../../../src/services/gameService');
    mockGameService = gameServiceModule.gameService;

    const handlersModule = await import('../../../src/handlers/gameHandlers');
    registerGameHandlers = handlersModule.registerGameHandlers;

    // Create mock socket
    mockSocket = {
      on: vi.fn((event: string, handler: any) => {
        if (event === 'game:requestState') {
          gameRequestStateHandler = handler;
        }
      }),
      emit: vi.fn(),
      data: {},
    };

    // Create mock io
    mockIo = {};

    // Register handlers
    registerGameHandlers(mockIo, mockSocket);
  });

  describe('game:requestState', () => {
    it('should register the handler', () => {
      expect(mockSocket.on).toHaveBeenCalledWith('game:requestState', expect.any(Function));
    });

    it('should emit game:stateUpdate with player view when found', async () => {
      const mockPlayerView = {
        id: 'game-123',
        phase: 'playing',
        myHand: [{ rank: '5', suit: 'hearts' }],
        stateVersion: 5,
      };

      vi.mocked(mockGameService.getPlayerView).mockResolvedValue(mockPlayerView);

      await gameRequestStateHandler({
        gameId: 'game-123',
        playerId: 'player-1',
      });

      expect(mockGameService.getPlayerView).toHaveBeenCalledWith('game-123', 'player-1');
      expect(mockSocket.emit).toHaveBeenCalledWith('game:stateUpdate', {
        gameState: mockPlayerView,
      });
    });

    it('should emit error when player view not found', async () => {
      vi.mocked(mockGameService.getPlayerView).mockResolvedValue(null);

      await gameRequestStateHandler({
        gameId: 'game-123',
        playerId: 'player-1',
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        message: 'Game not found or player not in game',
      });
    });

    it('should emit error when getPlayerView throws', async () => {
      vi.mocked(mockGameService.getPlayerView).mockRejectedValue(new Error('Database error'));

      await gameRequestStateHandler({
        gameId: 'game-123',
        playerId: 'player-1',
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        message: 'Failed to get game state',
      });
    });

    it('should include stateVersion in response for idempotent recovery', async () => {
      const mockPlayerView = {
        id: 'game-123',
        phase: 'playing',
        myHand: [],
        stateVersion: 10,
      };

      vi.mocked(mockGameService.getPlayerView).mockResolvedValue(mockPlayerView);

      await gameRequestStateHandler({
        gameId: 'game-123',
        playerId: 'player-1',
      });

      const emittedData = mockSocket.emit.mock.calls[0][1];
      expect(emittedData.gameState.stateVersion).toBe(10);
    });
  });
});
