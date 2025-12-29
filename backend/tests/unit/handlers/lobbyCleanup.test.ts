/**
 * Unit tests for lobby cleanup with grace period
 */

import { describe, it, expect, beforeEach, beforeAll, vi, afterEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { setupGlobalMockRedis, resetMockRedis } from '../../testUtils/redisSetup';

// Mock Socket.IO types
const mockEmit = vi.fn();
const mockTo = vi.fn(() => ({
  emit: mockEmit,
}));

const mockIo = {
  to: mockTo,
} as any;

describe('LobbyCleanup', () => {
  let lobbyService: any;
  let redisService: any;
  let cancelPendingDeletion: any;
  let scheduleLobbyCleanup: any;

  beforeAll(async () => {
    // Set up redis-mock globally before importing services
    await setupGlobalMockRedis();

    // Import services and cleanup functions after redis is mocked
    const lobbyServiceModule = await import('../../../src/services/lobbyService');
    const redisServiceModule = await import('../../../src/services/redisService');
    const lobbyCleanupModule = await import('../../../src/handlers/lobbyCleanup');

    lobbyService = lobbyServiceModule.lobbyService;
    redisService = redisServiceModule.redisService;
    cancelPendingDeletion = lobbyCleanupModule.cancelPendingDeletion;
    scheduleLobbyCleanup = lobbyCleanupModule.scheduleLobbyCleanup;
  });

  beforeEach(async () => {
    // Reset redis data between tests
    await resetMockRedis(redisService);

    // Clear all mocks
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('cancelPendingDeletion', () => {
    it('should return false when no pending deletion exists', () => {
      const lobbyId = uuidv4();
      const playerId = uuidv4();

      const result = cancelPendingDeletion(lobbyId, playerId);
      expect(result).toBe(false);
    });

    it('should cancel pending deletion and return true', async () => {
      const lobby = await lobbyService.createLobby();
      const player1 = await lobbyService.joinLobby(lobby.id, uuidv4(), 'Player 1');

      // Schedule cleanup
      scheduleLobbyCleanup(mockIo, lobby.id, player1.id, false, lobby.leaderId);

      // Cancel it
      const result = cancelPendingDeletion(lobby.id, player1.id);
      expect(result).toBe(true);

      // Advance timers - player should NOT be removed
      await vi.advanceTimersByTimeAsync(35000);

      // Verify player is still in lobby
      const updatedLobby = await lobbyService.getLobby(lobby.id);
      expect(updatedLobby?.players.has(player1.id)).toBe(true);
    });

    it('should return false when canceling for wrong player', async () => {
      const lobby = await lobbyService.createLobby();
      const player1 = await lobbyService.joinLobby(lobby.id, uuidv4(), 'Player 1');
      const wrongPlayerId = uuidv4();

      // Schedule cleanup for player1
      scheduleLobbyCleanup(mockIo, lobby.id, player1.id, false, lobby.leaderId);

      // Try to cancel for wrong player
      const result = cancelPendingDeletion(lobby.id, wrongPlayerId);
      expect(result).toBe(false);
    });
  });

  describe('scheduleLobbyCleanup', () => {
    it('should not remove player before grace period expires', async () => {
      const lobby = await lobbyService.createLobby();
      const player1 = await lobbyService.joinLobby(lobby.id, uuidv4(), 'Player 1');

      // Schedule cleanup
      scheduleLobbyCleanup(mockIo, lobby.id, player1.id, false, lobby.leaderId);

      // Advance time by 15 seconds (less than 30 second grace period)
      await vi.advanceTimersByTimeAsync(15000);

      // Player should still be in lobby
      const updatedLobby = await lobbyService.getLobby(lobby.id);
      expect(updatedLobby?.players.has(player1.id)).toBe(true);
    });

    it('should remove player after grace period expires', async () => {
      const lobby = await lobbyService.createLobby();
      const player1 = await lobbyService.joinLobby(lobby.id, uuidv4(), 'Player 1');

      // Schedule cleanup
      scheduleLobbyCleanup(mockIo, lobby.id, player1.id, false, lobby.leaderId);

      // Advance time by 35 seconds (past 30 second grace period)
      await vi.advanceTimersByTimeAsync(35000);

      // Player should be removed
      const updatedLobby = await lobbyService.getLobby(lobby.id);
      expect(updatedLobby).toBeNull(); // Lobby deleted since no players left
    });

    it('should delete lobby when last player is removed after grace period', async () => {
      const lobby = await lobbyService.createLobby();
      const player1 = await lobbyService.joinLobby(lobby.id, uuidv4(), 'Player 1');

      // Schedule cleanup
      scheduleLobbyCleanup(mockIo, lobby.id, player1.id, false, lobby.leaderId);

      // Advance time past grace period
      await vi.advanceTimersByTimeAsync(35000);

      // Lobby should be deleted
      const updatedLobby = await lobbyService.getLobby(lobby.id);
      expect(updatedLobby).toBeNull();
    });

    it('should not delete lobby if other players remain after grace period', async () => {
      const lobby = await lobbyService.createLobby();
      const player1 = await lobbyService.joinLobby(lobby.id, uuidv4(), 'Player 1');
      const player2 = await lobbyService.joinLobby(lobby.id, uuidv4(), 'Player 2');

      // Schedule cleanup for player2 only
      scheduleLobbyCleanup(mockIo, lobby.id, player2.id, false, lobby.leaderId);

      // Advance time past grace period
      await vi.advanceTimersByTimeAsync(35000);

      // Lobby should still exist with player1
      const updatedLobby = await lobbyService.getLobby(lobby.id);
      expect(updatedLobby).not.toBeNull();
      expect(updatedLobby?.players.has(player1.id)).toBe(true);
      expect(updatedLobby?.players.has(player2.id)).toBe(false);
    });

    it('should emit lobby:playerLeft event after grace period', async () => {
      const lobby = await lobbyService.createLobby();
      const player1 = await lobbyService.joinLobby(lobby.id, uuidv4(), 'Player 1');
      const player2 = await lobbyService.joinLobby(lobby.id, uuidv4(), 'Player 2');

      // Schedule cleanup for player2
      scheduleLobbyCleanup(mockIo, lobby.id, player2.id, false, lobby.leaderId);

      // Advance time past grace period
      await vi.advanceTimersByTimeAsync(35000);

      // Verify emit was called
      expect(mockTo).toHaveBeenCalledWith(lobby.id);
      expect(mockEmit).toHaveBeenCalledWith('lobby:playerLeft', expect.objectContaining({
        playerId: player2.id,
      }));
    });

    it('should emit lobby:leaderChanged event when leader leaves', async () => {
      const lobby = await lobbyService.createLobby();
      const player1 = await lobbyService.joinLobby(lobby.id, uuidv4(), 'Player 1'); // Leader
      const player2 = await lobbyService.joinLobby(lobby.id, uuidv4(), 'Player 2');

      // Schedule cleanup for leader
      scheduleLobbyCleanup(mockIo, lobby.id, player1.id, true, player1.id);

      // Advance time past grace period
      await vi.advanceTimersByTimeAsync(35000);

      // Verify leaderChanged event was emitted
      expect(mockEmit).toHaveBeenCalledWith('lobby:leaderChanged', expect.objectContaining({
        newLeaderId: player2.id,
      }));
    });

    it('should handle lobby already deleted during grace period', async () => {
      const lobby = await lobbyService.createLobby();
      const player1 = await lobbyService.joinLobby(lobby.id, uuidv4(), 'Player 1');

      // Schedule cleanup
      scheduleLobbyCleanup(mockIo, lobby.id, player1.id, false, lobby.leaderId);

      // Delete lobby manually before grace period
      await lobbyService.removeLobby(lobby.id);

      // Advance time past grace period - should not throw error
      await expect(vi.advanceTimersByTimeAsync(35000)).resolves.not.toThrow();
    });

    it('should handle player already removed during grace period', async () => {
      const lobby = await lobbyService.createLobby();
      const player1 = await lobbyService.joinLobby(lobby.id, uuidv4(), 'Player 1');
      const player2 = await lobbyService.joinLobby(lobby.id, uuidv4(), 'Player 2');

      // Schedule cleanup for player1
      scheduleLobbyCleanup(mockIo, lobby.id, player1.id, false, lobby.leaderId);

      // Remove player1 manually before grace period
      await lobbyService.leaveLobby(lobby.id, player1.id);

      // Advance time past grace period - should not throw error
      await expect(vi.advanceTimersByTimeAsync(35000)).resolves.not.toThrow();
    });

    it('should support multiple pending deletions for different players', async () => {
      const lobby = await lobbyService.createLobby();
      const player1 = await lobbyService.joinLobby(lobby.id, uuidv4(), 'Player 1');
      const player2 = await lobbyService.joinLobby(lobby.id, uuidv4(), 'Player 2');
      const player3 = await lobbyService.joinLobby(lobby.id, uuidv4(), 'Player 3');

      // Schedule cleanup for both player1 and player2
      scheduleLobbyCleanup(mockIo, lobby.id, player1.id, false, lobby.leaderId);
      scheduleLobbyCleanup(mockIo, lobby.id, player2.id, false, lobby.leaderId);

      // Advance time past grace period
      await vi.advanceTimersByTimeAsync(35000);

      // Both players should be removed, player3 should remain
      const updatedLobby = await lobbyService.getLobby(lobby.id);
      expect(updatedLobby).not.toBeNull();
      expect(updatedLobby?.players.has(player1.id)).toBe(false);
      expect(updatedLobby?.players.has(player2.id)).toBe(false);
      expect(updatedLobby?.players.has(player3.id)).toBe(true);
    });

    it('should allow canceling one deletion while letting another proceed', async () => {
      const lobby = await lobbyService.createLobby();
      const player1 = await lobbyService.joinLobby(lobby.id, uuidv4(), 'Player 1');
      const player2 = await lobbyService.joinLobby(lobby.id, uuidv4(), 'Player 2');

      // Schedule cleanup for both players
      scheduleLobbyCleanup(mockIo, lobby.id, player1.id, false, lobby.leaderId);
      scheduleLobbyCleanup(mockIo, lobby.id, player2.id, false, lobby.leaderId);

      // Cancel player1's deletion
      cancelPendingDeletion(lobby.id, player1.id);

      // Advance time past grace period
      await vi.advanceTimersByTimeAsync(35000);

      // Player1 should remain, player2 should be removed
      const updatedLobby = await lobbyService.getLobby(lobby.id);
      expect(updatedLobby).not.toBeNull();
      expect(updatedLobby?.players.has(player1.id)).toBe(true);
      expect(updatedLobby?.players.has(player2.id)).toBe(false);
    });
  });
});
