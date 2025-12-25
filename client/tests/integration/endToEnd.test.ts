/**
 * End-to-end integration tests for complete game flows
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SocketClient } from '../../src/socket';
import { ApiClient } from '../../src/api';
import { createServer } from '../../../backend/src/server';
import { Server } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import {
  LobbyPlayerJoinedEvent,
  LobbyGameStartingEvent,
  GameStateUpdateEvent,
} from '@hilo/shared';

describe('End-to-End Integration Tests', () => {
  let server: Server;
  let io: SocketIOServer;
  const testPort = 3003;
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
  });

  afterAll(async () => {
    // Close connections
    io.close();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  describe('Complete Lobby Flow', () => {
    it('should handle full lobby creation and join flow', async () => {
      const apiClient = new ApiClient(baseURL);

      // 1. Create lobby
      const createResponse = await apiClient.createLobby();
      expect(createResponse.lobbyId).toBeDefined();
      const lobbyId = createResponse.lobbyId;

      // 2. First player joins via HTTP
      const player1Response = await apiClient.joinLobby(lobbyId, 'Player1');
      expect(player1Response.playerId).toBeDefined();
      expect(player1Response.isLeader).toBe(true);
      const player1Id = player1Response.playerId;

      // 3. First player connects via socket
      const socket1 = new SocketClient(baseURL);
      await socket1.connect();

      const socket1JoinEvent = await new Promise<LobbyPlayerJoinedEvent>((resolve) => {
        socket1.on('lobby:playerJoined', (data) => {
          resolve(data);
        });
        socket1.joinLobby(lobbyId, player1Id);
      });

      expect(socket1JoinEvent.player.id).toBe(player1Id);
      expect(socket1JoinEvent.lobby.players).toHaveLength(1);

      // 4. Second player joins via HTTP
      const player2Response = await apiClient.joinLobby(lobbyId, 'Player2');
      expect(player2Response.isLeader).toBe(false);
      const player2Id = player2Response.playerId;

      // 5. Second player connects via socket
      const socket2 = new SocketClient(baseURL);
      await socket2.connect();

      // Both sockets should receive the playerJoined event
      const [socket1Event, socket2Event] = await Promise.all([
        new Promise<LobbyPlayerJoinedEvent>((resolve) => {
          socket1.once('lobby:playerJoined', (data) => {
            if (data.player.id === player2Id) {
              resolve(data);
            }
          });
        }),
        new Promise<LobbyPlayerJoinedEvent>((resolve) => {
          socket2.on('lobby:playerJoined', (data) => {
            resolve(data);
          });
          socket2.joinLobby(lobbyId, player2Id);
        }),
      ]);

      expect(socket1Event.lobby.players).toHaveLength(2);
      expect(socket2Event.lobby.players).toHaveLength(2);

      // Cleanup
      socket1.disconnect();
      socket2.disconnect();
    });

    it('should not create duplicate players when joining', async () => {
      const apiClient = new ApiClient(baseURL);

      // Create lobby
      const createResponse = await apiClient.createLobby();
      const lobbyId = createResponse.lobbyId;

      // Join via HTTP
      const joinResponse = await apiClient.joinLobby(lobbyId, 'TestPlayer');
      const playerId = joinResponse.playerId;

      // Connect via socket
      const socket = new SocketClient(baseURL);
      await socket.connect();

      const joinEvent = await new Promise<LobbyPlayerJoinedEvent>((resolve) => {
        socket.on('lobby:playerJoined', (data) => {
          resolve(data);
        });
        socket.joinLobby(lobbyId, playerId);
      });

      // Verify only one player exists
      expect(joinEvent.lobby.players).toHaveLength(1);
      expect(joinEvent.lobby.players[0].id).toBe(playerId);

      socket.disconnect();
    });
  });

  describe('Complete Game Flow', () => {
    it('should handle full game start flow', async () => {
      const apiClient = new ApiClient(baseURL);

      // 1. Create lobby and add players
      const createResponse = await apiClient.createLobby();
      const lobbyId = createResponse.lobbyId;

      const player1Response = await apiClient.joinLobby(lobbyId, 'Player1');
      const player1Id = player1Response.playerId;

      const player2Response = await apiClient.joinLobby(lobbyId, 'Player2');
      const player2Id = player2Response.playerId;

      // 2. Connect both players via socket
      const socket1 = new SocketClient(baseURL);
      const socket2 = new SocketClient(baseURL);

      await socket1.connect();
      await socket2.connect();

      socket1.joinLobby(lobbyId, player1Id);
      socket2.joinLobby(lobbyId, player2Id);

      // Wait for connections
      await new Promise((resolve) => setTimeout(resolve, 200));

      // 3. Start game and listen for events
      const [gameStartEvent1, gameStartEvent2, gameStateEvent1] = await Promise.all([
        new Promise<LobbyGameStartingEvent>((resolve) => {
          socket1.once('lobby:gameStarting', (data) => {
            resolve(data);
          });
        }),
        new Promise<LobbyGameStartingEvent>((resolve) => {
          socket2.once('lobby:gameStarting', (data) => {
            resolve(data);
          });
        }),
        new Promise<GameStateUpdateEvent>((resolve) => {
          socket1.once('game:stateUpdate', (data) => {
            resolve(data);
          });
        }),
        apiClient.startGame(lobbyId, player1Id),
      ]);

      // Verify game started
      expect(gameStartEvent1.gameId).toBeDefined();
      expect(gameStartEvent1.gameId).toBe(gameStartEvent2.gameId);
      expect(gameStartEvent1.gameId).toMatch(new RegExp(`^${lobbyId}:game:`));

      // Verify game state received
      expect(gameStateEvent1.gameState).toBeDefined();
      expect(gameStateEvent1.gameState.id).toBe(gameStartEvent1.gameId);
      expect(gameStateEvent1.gameState.phase).toBe('setup');
      expect(gameStateEvent1.gameState.myHand).toBeDefined();
      expect(gameStateEvent1.gameState.myHand.length).toBe(6);

      // Cleanup
      socket1.disconnect();
      socket2.disconnect();
    });

    it('should verify game ID has correct format with room prefix', async () => {
      const apiClient = new ApiClient(baseURL);

      // Create lobby with two players
      const createResponse = await apiClient.createLobby();
      const lobbyId = createResponse.lobbyId;

      const player1Response = await apiClient.joinLobby(lobbyId, 'Player1');
      const player1Id = player1Response.playerId;
      await apiClient.joinLobby(lobbyId, 'Player2');

      // Start game
      const gameResponse = await apiClient.startGame(lobbyId, player1Id);

      // Verify game ID format: <roomId>:game:<uuid>
      expect(gameResponse.gameState.id).toMatch(new RegExp(`^${lobbyId}:game:[a-f0-9-]+$`));

      // Verify the room ID prefix matches the lobby ID
      const gameIdParts = gameResponse.gameState.id.split(':game:');
      expect(gameIdParts[0]).toBe(lobbyId);
    });
  });

  describe('Player Leave Flow', () => {
    it('should handle player leaving lobby', async () => {
      const apiClient = new ApiClient(baseURL);

      // Create lobby with two players
      const createResponse = await apiClient.createLobby();
      const lobbyId = createResponse.lobbyId;

      const player1Response = await apiClient.joinLobby(lobbyId, 'Player1');
      const player1Id = player1Response.playerId;

      const player2Response = await apiClient.joinLobby(lobbyId, 'Player2');
      const player2Id = player2Response.playerId;

      // Connect both via socket
      const socket1 = new SocketClient(baseURL);
      const socket2 = new SocketClient(baseURL);

      await socket1.connect();
      await socket2.connect();

      socket1.joinLobby(lobbyId, player1Id);
      socket2.joinLobby(lobbyId, player2Id);

      // Wait for connections
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Player 2 leaves
      const leaveEvent = await new Promise<any>((resolve) => {
        socket1.once('lobby:playerLeft', (data) => {
          resolve(data);
        });
        socket2.leaveLobby(lobbyId, player2Id);
      });

      expect(leaveEvent.playerId).toBe(player2Id);
      expect(leaveEvent.lobby.players).toHaveLength(1);

      // Cleanup
      socket1.disconnect();
      socket2.disconnect();
    });
  });
});
