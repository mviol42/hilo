/**
 * Integration tests for disconnect grace period
 *
 * Part 1: Tests the actual cleanup logic (performPlayerCleanup) without timers
 * Part 2: Tests that cleanup is scheduled correctly on disconnect
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { createTestServer, closeTestServer, TestServer } from '../setup';
import {
  createSocketClient,
  connectSocket,
  disconnectSocket,
  waitForEvent,
  cleanupSockets,
  setTestPort,
  TestSocket,
} from './helpers';
import { lobbyService } from '../../../src/services/lobbyService';
import { performPlayerCleanup } from '../../../src/handlers/lobbyCleanup';
import request from 'supertest';

describe('Disconnect Grace Period', () => {
  let testServer: TestServer;
  let sockets: TestSocket[] = [];

  beforeAll(async () => {
    testServer = await createTestServer();
    setTestPort(testServer.port);
  });

  afterAll(async () => {
    await closeTestServer(testServer);
  });

  beforeEach(async () => {
    // Clean up any existing sockets
    await cleanupSockets(sockets);
    sockets = [];

    // Clear lobbies
    await lobbyService.clearAll();
  });

  describe('Part 1: Cleanup Logic (without timers)', () => {
    it('should remove player from lobby when cleanup is performed', async () => {
      // Create lobby with one player
      const createResponse = await request(testServer.app).post('/api/lobby/create').expect(201);
      const { lobbyId } = createResponse.body;
      const playerId = uuidv4();

      await request(testServer.app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId, playerName: 'Test Player' })
        .expect(200);

      // Verify player is in lobby
      const lobbyBefore = await lobbyService.getLobby(lobbyId);
      expect(lobbyBefore?.players.has(playerId)).toBe(true);

      // Perform cleanup directly (bypassing timer)
      await performPlayerCleanup(testServer.io, lobbyId, playerId, true, playerId);

      // Lobby should be deleted (no players left)
      const lobbyAfter = await lobbyService.getLobby(lobbyId);
      expect(lobbyAfter).toBeNull();
    });

    it('should keep lobby when other players remain after cleanup', async () => {
      // Create lobby with two players
      const createResponse = await request(testServer.app).post('/api/lobby/create').expect(201);
      const { lobbyId } = createResponse.body;
      const player1Id = uuidv4();
      const player2Id = uuidv4();

      await request(testServer.app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: player1Id, playerName: 'Player 1' })
        .expect(200);

      await request(testServer.app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: player2Id, playerName: 'Player 2' })
        .expect(200);

      // Perform cleanup for player2 only
      await performPlayerCleanup(testServer.io, lobbyId, player2Id, false, player1Id);

      // Lobby should still exist with player1
      const lobby = await lobbyService.getLobby(lobbyId);
      expect(lobby).not.toBeNull();
      expect(lobby?.players.has(player1Id)).toBe(true);
      expect(lobby?.players.has(player2Id)).toBe(false);
    });

    it('should emit lobby:playerLeft event when cleanup is performed', async () => {
      // Create lobby with two players
      const createResponse = await request(testServer.app).post('/api/lobby/create').expect(201);
      const { lobbyId } = createResponse.body;
      const player1Id = uuidv4();
      const player2Id = uuidv4();

      await request(testServer.app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: player1Id, playerName: 'Player 1' })
        .expect(200);

      await request(testServer.app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: player2Id, playerName: 'Player 2' })
        .expect(200);

      // Connect socket for player1
      const socket1 = createSocketClient();
      await connectSocket(socket1);
      sockets.push(socket1);
      socket1.emit('lobby:join', { lobbyId, playerId: player1Id });
      await waitForEvent(socket1, 'lobby:playerJoined');

      // Set up listener for playerLeft event
      const playerLeftPromise = waitForEvent(socket1, 'lobby:playerLeft');

      // Perform cleanup for player2
      await performPlayerCleanup(testServer.io, lobbyId, player2Id, false, player1Id);

      // Wait for playerLeft event
      const playerLeftEvent = await playerLeftPromise;
      expect(playerLeftEvent.playerId).toBe(player2Id);
      expect(playerLeftEvent.lobby.players).toHaveLength(1);
    });

    it('should handle lobby already deleted gracefully', async () => {
      const lobbyId = uuidv4();
      const playerId = uuidv4();

      // Perform cleanup on non-existent lobby - should not throw
      await expect(performPlayerCleanup(testServer.io, lobbyId, playerId, false, playerId)).resolves.not.toThrow();
    });

    it('should handle player already removed gracefully', async () => {
      // Create lobby with one player
      const createResponse = await request(testServer.app).post('/api/lobby/create').expect(201);
      const { lobbyId } = createResponse.body;
      const player1Id = uuidv4();
      const player2Id = uuidv4();

      await request(testServer.app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: player1Id, playerName: 'Player 1' })
        .expect(200);

      // Perform cleanup for player that was never in lobby - should not throw
      await expect(performPlayerCleanup(testServer.io, lobbyId, player2Id, false, player1Id)).resolves.not.toThrow();
    });
  });

  describe('Part 2: Scheduling on Disconnect', () => {
    it('should schedule cleanup with correct timeout duration on disconnect', async () => {
      // Spy on setTimeout to verify it's called with correct duration
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      // Create lobby via HTTP
      const createResponse = await request(testServer.app).post('/api/lobby/create').expect(201);
      const { lobbyId } = createResponse.body;
      const playerId = uuidv4();

      // Join lobby via HTTP
      await request(testServer.app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId, playerName: 'Test Player' })
        .expect(200);

      // Connect socket and join lobby
      const socket = createSocketClient();
      await connectSocket(socket);
      socket.emit('lobby:join', { lobbyId, playerId });
      await waitForEvent(socket, 'lobby:playerJoined');

      // Clear previous setTimeout calls
      setTimeoutSpy.mockClear();

      // Disconnect socket
      await disconnectSocket(socket);

      // Wait a bit for disconnect handler to execute
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify setTimeout was called with 60 second delay (60000ms)
      expect(setTimeoutSpy).toHaveBeenCalledWith(
        expect.any(Function),
        60000 // 60 seconds grace period
      );

      // Cleanup
      setTimeoutSpy.mockRestore();
    });

    it('should not immediately remove player from waiting lobby on disconnect', async () => {
      // Create lobby via HTTP
      const createResponse = await request(testServer.app).post('/api/lobby/create').expect(201);
      const { lobbyId } = createResponse.body;
      const playerId = uuidv4();

      // Join lobby via HTTP
      await request(testServer.app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId, playerName: 'Test Player' })
        .expect(200);

      // Connect socket and join lobby
      const socket = createSocketClient();
      await connectSocket(socket);
      socket.emit('lobby:join', { lobbyId, playerId });
      await waitForEvent(socket, 'lobby:playerJoined');

      // Disconnect socket
      await disconnectSocket(socket);

      // Player should still be in lobby immediately after disconnect
      const lobby = await lobbyService.getLobby(lobbyId);
      expect(lobby).not.toBeNull();
      expect(lobby?.players.has(playerId)).toBe(true);
    });

    it('should allow player to rejoin after disconnect', async () => {
      // Create lobby and join
      const createResponse = await request(testServer.app).post('/api/lobby/create').expect(201);
      const { lobbyId } = createResponse.body;
      const playerId = uuidv4();

      await request(testServer.app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId, playerName: 'Test Player' })
        .expect(200);

      // Connect and join via socket
      const socket1 = createSocketClient();
      await connectSocket(socket1);
      socket1.emit('lobby:join', { lobbyId, playerId });
      await waitForEvent(socket1, 'lobby:playerJoined');

      // Disconnect
      await disconnectSocket(socket1);

      // Reconnect with new socket immediately
      const socket2 = createSocketClient();
      await connectSocket(socket2);
      sockets.push(socket2);

      const rejoinPromise = waitForEvent(socket2, 'lobby:playerJoined');
      socket2.emit('lobby:join', { lobbyId, playerId });
      await rejoinPromise;

      // Player should be in lobby
      const lobby = await lobbyService.getLobby(lobbyId);
      expect(lobby).not.toBeNull();
      expect(lobby?.players.has(playerId)).toBe(true);
    });

    it('should cancel grace period when player reconnects', async () => {
      // Create lobby and join
      const createResponse = await request(testServer.app).post('/api/lobby/create').expect(201);
      const { lobbyId } = createResponse.body;
      const playerId = uuidv4();

      await request(testServer.app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId, playerName: 'Test Player' })
        .expect(200);

      // Connect and join
      const socket1 = createSocketClient();
      await connectSocket(socket1);
      socket1.emit('lobby:join', { lobbyId, playerId });
      await waitForEvent(socket1, 'lobby:playerJoined');

      // Disconnect
      await disconnectSocket(socket1);

      // Reconnect quickly
      const socket2 = createSocketClient();
      await connectSocket(socket2);
      sockets.push(socket2);
      socket2.emit('lobby:join', { lobbyId, playerId });
      await waitForEvent(socket2, 'lobby:playerJoined');

      // Player should still be in lobby
      const lobby = await lobbyService.getLobby(lobbyId);
      expect(lobby).not.toBeNull();
      expect(lobby?.players.has(playerId)).toBe(true);
    });
  });

  describe('In-Game Lobbies (No Grace Period)', () => {
    it('should keep player in game lobby on disconnect without grace period', async () => {
      // Create lobby with two players
      const createResponse = await request(testServer.app).post('/api/lobby/create').expect(201);
      const { lobbyId } = createResponse.body;
      const player1Id = uuidv4();
      const player2Id = uuidv4();

      await request(testServer.app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: player1Id, playerName: 'Player 1' })
        .expect(200);

      await request(testServer.app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: player2Id, playerName: 'Player 2' })
        .expect(200);

      // Ready player2
      await request(testServer.app)
        .post('/api/lobby/ready')
        .send({ lobbyId, playerId: player2Id })
        .expect(200);

      // Start game
      await request(testServer.app)
        .post('/api/game/start')
        .send({ lobbyId, playerId: player1Id })
        .expect(200);

      // Connect sockets
      const socket1 = createSocketClient();
      const socket2 = createSocketClient();
      await connectSocket(socket1);
      await connectSocket(socket2);
      sockets.push(socket1, socket2);

      socket1.emit('lobby:join', { lobbyId, playerId: player1Id });
      await waitForEvent(socket1, 'lobby:playerJoined');

      socket2.emit('lobby:join', { lobbyId, playerId: player2Id });
      await waitForEvent(socket2, 'lobby:playerJoined');

      // Disconnect player2
      await disconnectSocket(socket2);
      sockets = sockets.filter(s => s !== socket2);

      // Player should immediately still be in lobby (no grace period, kept for reconnection)
      const lobby = await lobbyService.getLobby(lobbyId);
      expect(lobby).not.toBeNull();
      expect(lobby?.players.has(player2Id)).toBe(true);
      expect(lobby?.status).toBe('in_game');
    });
  });
});
