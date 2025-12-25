/**
 * Integration tests for Socket.IO client
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { SocketClient } from '../../src/socket';
import { ApiClient } from '../../src/api';
import { createServer } from '../../../backend/src/server';
import { Server } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { LobbyPlayerJoinedEvent } from '@hilo/shared';

describe('SocketClient Integration Tests', () => {
  let server: Server;
  let io: SocketIOServer;
  let apiClient: ApiClient;
  let socketClient: SocketClient;
  const testPort = 3002;
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

  beforeEach(() => {
    // Create a fresh socket client for each test
    socketClient = new SocketClient(baseURL);
  });

  describe('Connection Management', () => {
    it('should connect to server', async () => {
      await expect(socketClient.connect()).resolves.not.toThrow();
      socketClient.disconnect();
    });

    it('should disconnect from server', async () => {
      await socketClient.connect();
      expect(() => socketClient.disconnect()).not.toThrow();
    });

    it('should reject connection with timeout', async () => {
      // Try to connect to non-existent server
      const badClient = new SocketClient('http://localhost:9999');
      await expect(badClient.connect()).rejects.toThrow();
    });
  });

  describe('Lobby Events', () => {
    it('should join lobby via socket after HTTP join', async () => {
      // Create lobby and join via HTTP
      const createResponse = await apiClient.createLobby();
      const lobbyId = createResponse.lobbyId;
      const joinResponse = await apiClient.joinLobby(lobbyId, 'TestPlayer');
      const playerId = joinResponse.playerId;

      // Connect and join via socket
      await socketClient.connect();

      const joinEvent = await new Promise<LobbyPlayerJoinedEvent>((resolve) => {
        socketClient.on('lobby:playerJoined', (data) => {
          resolve(data);
        });
        socketClient.joinLobby(lobbyId, playerId);
      });

      expect(joinEvent).toBeDefined();
      expect(joinEvent.player.id).toBe(playerId);
      expect(joinEvent.lobby.id).toBe(lobbyId);

      socketClient.disconnect();
    });

    it('should receive playerJoined event when another player joins', async () => {
      // Create lobby and join with first player
      const createResponse = await apiClient.createLobby();
      const lobbyId = createResponse.lobbyId;
      const player1Response = await apiClient.joinLobby(lobbyId, 'Player1');
      const player1Id = player1Response.playerId;

      // Connect first player via socket
      const socket1 = new SocketClient(baseURL);
      await socket1.connect();
      socket1.joinLobby(lobbyId, player1Id);

      // Wait a bit for socket to join
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Join with second player and listen for event on first socket
      const joinEvent = await new Promise<LobbyPlayerJoinedEvent>((resolve) => {
        socket1.on('lobby:playerJoined', (data) => {
          if (data.player.name === 'Player2') {
            resolve(data);
          }
        });

        // Join with second player
        apiClient.joinLobby(lobbyId, 'Player2').then((response) => {
          const socket2 = new SocketClient(baseURL);
          socket2.connect().then(() => {
            socket2.joinLobby(lobbyId, response.playerId);
          });
        });
      });

      expect(joinEvent).toBeDefined();
      expect(joinEvent.player.name).toBe('Player2');
      expect(joinEvent.lobby.players).toHaveLength(2);

      socket1.disconnect();
    });

    it('should leave lobby via socket', async () => {
      // Create lobby and join
      const createResponse = await apiClient.createLobby();
      const lobbyId = createResponse.lobbyId;
      const joinResponse = await apiClient.joinLobby(lobbyId, 'TestPlayer');
      const playerId = joinResponse.playerId;

      // Connect via socket
      await socketClient.connect();
      socketClient.joinLobby(lobbyId, playerId);

      // Wait for join
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Leave lobby
      expect(() => socketClient.leaveLobby(lobbyId, playerId)).not.toThrow();

      socketClient.disconnect();
    });

    it('should receive error when joining with invalid playerId', async () => {
      // Create lobby
      const createResponse = await apiClient.createLobby();
      const lobbyId = createResponse.lobbyId;

      // Connect and try to join with invalid playerId
      await socketClient.connect();

      const errorEvent = await new Promise<{ message: string }>((resolve) => {
        socketClient.on('error', (data) => {
          resolve(data);
        });
        socketClient.joinLobby(lobbyId, 'invalid-player-id');
      });

      expect(errorEvent).toBeDefined();
      expect(errorEvent.message).toContain('Player not found');

      socketClient.disconnect();
    });
  });

  describe('Game Events', () => {
    it('should receive gameStarting event when game starts', async () => {
      // Create lobby with two players
      const createResponse = await apiClient.createLobby();
      const lobbyId = createResponse.lobbyId;
      const player1Response = await apiClient.joinLobby(lobbyId, 'Player1');
      const player1Id = player1Response.playerId;
      await apiClient.joinLobby(lobbyId, 'Player2');

      // Connect first player via socket
      await socketClient.connect();
      socketClient.joinLobby(lobbyId, player1Id);

      // Wait for join
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Start game and wait for event
      const gameStartEvent = await new Promise<{ gameId: string }>((resolve) => {
        socketClient.on('lobby:gameStarting', (data) => {
          resolve(data);
        });
        apiClient.startGame(lobbyId, player1Id);
      });

      expect(gameStartEvent).toBeDefined();
      expect(gameStartEvent.gameId).toBeDefined();
      expect(gameStartEvent.gameId).toMatch(new RegExp(`^${lobbyId}:game:`));

      socketClient.disconnect();
    });
  });
});
