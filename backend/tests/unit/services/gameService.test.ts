/**
 * Unit tests for GameService
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { setupGlobalMockRedis, resetMockRedis } from '../../testUtils/redisSetup';

describe('GameService', () => {
  let gameService: any;
  let lobbyService: any;
  let redisService: any;

  beforeAll(async () => {
    // Set up redis-mock globally before importing services
    await setupGlobalMockRedis();

    // Import services after redis is mocked
    const gameServiceModule = await import('../../../src/services/gameService');
    const lobbyServiceModule = await import('../../../src/services/lobbyService');
    const redisServiceModule = await import('../../../src/services/redisService');

    gameService = new gameServiceModule.GameService();
    lobbyService = new lobbyServiceModule.LobbyService();
    redisService = redisServiceModule.redisService;
  });

  beforeEach(async () => {
    // Reset redis data between tests
    await resetMockRedis(redisService);
  });

  describe('getPlayerView', () => {
    it('should include player names in the view', async () => {
      // Create lobby with players
      const lobby = await lobbyService.createLobby();
      const player1Id = uuidv4();
      const player2Id = uuidv4();

      await lobbyService.joinLobby(lobby.id, player1Id, 'Alice');
      await lobbyService.joinLobby(lobby.id, player2Id, 'Bob');

      // Create game
      const game = await gameService.createGame(lobby.id, [player1Id, player2Id]);

      // Get player view
      const playerView = await gameService.getPlayerView(game.id, player1Id);

      // Verify player names are included
      expect(playerView).toBeDefined();
      expect(playerView?.playerNames).toBeDefined();
      expect(playerView?.playerNames[player1Id]).toBe('Alice');
      expect(playerView?.playerNames[player2Id]).toBe('Bob');

      // Verify other players have names
      expect(playerView?.otherPlayers[player2Id]).toBeDefined();
      expect(playerView?.otherPlayers[player2Id].name).toBe('Bob');
    });

    it('should include winner name when game ends', async () => {
      // Create lobby with players
      const lobby = await lobbyService.createLobby();
      const player1Id = uuidv4();
      const player2Id = uuidv4();

      await lobbyService.joinLobby(lobby.id, player1Id, 'Alice');
      await lobbyService.joinLobby(lobby.id, player2Id, 'Bob');

      // Create game
      const game = await gameService.createGame(lobby.id, [player1Id, player2Id]);

      // Manually set a winner (simulating game end)
      game.winner = player2Id;
      game.phase = 'ended';
      await gameService.updateGame(game.id, game);

      // Get player view
      const playerView = await gameService.getPlayerView(game.id, player1Id);

      // Verify winner name is included
      expect(playerView).toBeDefined();
      expect(playerView?.winner).toBe(player2Id);
      expect(playerView?.winnerName).toBe('Bob');
    });

    it('should use fallback name when lobby is not found', async () => {
      // Create lobby with players
      const lobby = await lobbyService.createLobby();
      const player1Id = uuidv4();
      const player2Id = uuidv4();

      await lobbyService.joinLobby(lobby.id, player1Id, 'Alice');
      await lobbyService.joinLobby(lobby.id, player2Id, 'Bob');

      // Create game
      const game = await gameService.createGame(lobby.id, [player1Id, player2Id]);

      // Delete the lobby to simulate lobby not found
      await redisService.deleteLobby(lobby.id);

      // Get player view
      const playerView = await gameService.getPlayerView(game.id, player1Id);

      // Verify fallback names are used
      expect(playerView).toBeDefined();
      expect(playerView?.otherPlayers[player2Id]).toBeDefined();
      expect(playerView?.otherPlayers[player2Id].name).toBe(`Player ${player2Id.substring(0, 8)}`);
    });

    it('should not include current player in otherPlayers', async () => {
      // Create lobby with players
      const lobby = await lobbyService.createLobby();
      const player1Id = uuidv4();
      const player2Id = uuidv4();

      await lobbyService.joinLobby(lobby.id, player1Id, 'Alice');
      await lobbyService.joinLobby(lobby.id, player2Id, 'Bob');

      // Create game
      const game = await gameService.createGame(lobby.id, [player1Id, player2Id]);

      // Get player view for player1
      const playerView = await gameService.getPlayerView(game.id, player1Id);

      // Verify player1 is not in otherPlayers
      expect(playerView).toBeDefined();
      expect(playerView?.otherPlayers[player1Id]).toBeUndefined();
      expect(playerView?.otherPlayers[player2Id]).toBeDefined();
    });

    it('should return null for non-existent game', async () => {
      const playerView = await gameService.getPlayerView('non-existent-game-id', uuidv4());
      expect(playerView).toBeNull();
    });

    it('should return null for non-existent player', async () => {
      // Create lobby with players
      const lobby = await lobbyService.createLobby();
      const player1Id = uuidv4();
      const player2Id = uuidv4();

      await lobbyService.joinLobby(lobby.id, player1Id, 'Alice');
      await lobbyService.joinLobby(lobby.id, player2Id, 'Bob');

      // Create game
      const game = await gameService.createGame(lobby.id, [player1Id, player2Id]);

      // Try to get view for non-existent player
      const playerView = await gameService.getPlayerView(game.id, uuidv4());
      expect(playerView).toBeNull();
    });
  });
});
