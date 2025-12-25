/**
 * Integration tests for HTTP API client
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ApiClient } from '../../src/api';
import { createServer } from '../../../backend/src/server';
import { Server } from 'http';
import { Server as SocketIOServer } from 'socket.io';

describe('ApiClient Integration Tests', () => {
  let server: Server;
  let io: SocketIOServer;
  let apiClient: ApiClient;
  const testPort = 3001;
  const baseURL = `http://localhost:${testPort}`;

  beforeAll(async () => {
    // Start test server
    const result = await createServer();
    server = result.server;
    io = result.io;

    await new Promise<void>((resolve) => {
      server.listen(testPort, () => {
        resolve();
      });
    });

    // Create API client
    apiClient = new ApiClient(baseURL);
  });

  afterAll(async () => {
    // Close connections
    io.close();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  describe('Lobby Management', () => {
    it('should create a new lobby', async () => {
      const response = await apiClient.createLobby();

      expect(response).toBeDefined();
      expect(response.lobbyId).toBeDefined();
      expect(typeof response.lobbyId).toBe('string');
    });

    it('should join an existing lobby', async () => {
      // First create a lobby
      const createResponse = await apiClient.createLobby();
      const lobbyId = createResponse.lobbyId;

      // Then join it
      const joinResponse = await apiClient.joinLobby(lobbyId, 'TestPlayer');

      expect(joinResponse).toBeDefined();
      expect(joinResponse.playerId).toBeDefined();
      expect(joinResponse.isLeader).toBe(true); // First player is leader
      expect(joinResponse.lobby).toBeDefined();
      expect(joinResponse.lobby.id).toBe(lobbyId);
      expect(joinResponse.lobby.players).toHaveLength(1);
      expect(joinResponse.lobby.players[0].name).toBe('TestPlayer');
    });

    it('should allow multiple players to join a lobby', async () => {
      // Create lobby and join with first player
      const createResponse = await apiClient.createLobby();
      const lobbyId = createResponse.lobbyId;
      const player1Response = await apiClient.joinLobby(lobbyId, 'Player1');

      // Join with second player
      const player2Response = await apiClient.joinLobby(lobbyId, 'Player2');

      expect(player2Response.isLeader).toBe(false); // Second player is not leader
      expect(player2Response.lobby.players).toHaveLength(2);

      const playerNames = player2Response.lobby.players.map((p) => p.name);
      expect(playerNames).toContain('Player1');
      expect(playerNames).toContain('Player2');
    });

    it('should throw error when joining non-existent lobby', async () => {
      await expect(
        apiClient.joinLobby('non-existent-lobby-id', 'TestPlayer')
      ).rejects.toThrow();
    });

    it('should allow player to leave lobby', async () => {
      // Create and join lobby
      const createResponse = await apiClient.createLobby();
      const lobbyId = createResponse.lobbyId;
      const joinResponse = await apiClient.joinLobby(lobbyId, 'Player1');
      const playerId = joinResponse.playerId;

      // Leave lobby
      await expect(apiClient.leaveLobby(lobbyId, playerId)).resolves.not.toThrow();
    });

    it('should throw error when leaving non-existent lobby', async () => {
      await expect(
        apiClient.leaveLobby('non-existent-lobby', 'non-existent-player')
      ).rejects.toThrow();
    });
  });

  describe('Game Management', () => {
    it('should start a game with minimum players', async () => {
      // Create lobby
      const createResponse = await apiClient.createLobby();
      const lobbyId = createResponse.lobbyId;

      // Join with two players
      const player1Response = await apiClient.joinLobby(lobbyId, 'Player1');
      const player1Id = player1Response.playerId;
      await apiClient.joinLobby(lobbyId, 'Player2');

      // Start game (only leader can start)
      const gameResponse = await apiClient.startGame(lobbyId, player1Id);

      expect(gameResponse).toBeDefined();
      expect(gameResponse.gameState).toBeDefined();
      expect(gameResponse.gameState.id).toBeDefined();
      expect(gameResponse.gameState.id).toMatch(new RegExp(`^${lobbyId}:game:`));
      expect(gameResponse.gameState.phase).toBe('setup');
    });

    it('should throw error when non-leader tries to start game', async () => {
      // Create lobby with two players
      const createResponse = await apiClient.createLobby();
      const lobbyId = createResponse.lobbyId;
      await apiClient.joinLobby(lobbyId, 'Player1');
      const player2Response = await apiClient.joinLobby(lobbyId, 'Player2');
      const player2Id = player2Response.playerId;

      // Try to start game as non-leader
      await expect(apiClient.startGame(lobbyId, player2Id)).rejects.toThrow();
    });

    it('should throw error when starting game with only one player', async () => {
      // Create lobby with only one player
      const createResponse = await apiClient.createLobby();
      const lobbyId = createResponse.lobbyId;
      const joinResponse = await apiClient.joinLobby(lobbyId, 'Player1');
      const playerId = joinResponse.playerId;

      // Try to start game
      await expect(apiClient.startGame(lobbyId, playerId)).rejects.toThrow();
    });
  });
});
