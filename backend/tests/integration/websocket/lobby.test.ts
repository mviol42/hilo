/**
 * Integration tests for WebSocket lobby events
 *
 * NOTE: WebSocket mutation events (lobby:join, lobby:leave) have been removed.
 * All mutations are now handled via HTTP API.
 * These tests are disabled and need to be refactored to test only read-only WebSocket events.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { createTestServer, closeTestServer, TestServer } from '../setup';
import {
  createSocketClient,
  connectSocket,
  disconnectSocket,
  waitForEvent,
  cleanupSockets,
  TestSocket,
} from './helpers';
import { lobbyService } from '../../../src/services/lobbyService';
import request from 'supertest';

describe.skip('WebSocket Lobby Events (DISABLED - needs refactoring for HTTP-only mutations)', () => {
  let testServer: TestServer;
  let sockets: TestSocket[] = [];

  beforeAll(async () => {
    testServer = await createTestServer();
  });

  afterAll(async () => {
    await closeTestServer(testServer);
  });

  beforeEach(async () => {
    // Clean up any existing sockets
    await cleanupSockets(sockets);
    sockets = [];

    // Clear lobbies
    lobbyService.clearAll();
  });

  describe('Connection', () => {
    it('should allow client to connect', async () => {
      const socket = createSocketClient();
      await connectSocket(socket);

      expect(socket.connected).toBe(true);
      sockets.push(socket);
    });

    it('should allow client to disconnect', async () => {
      const socket = createSocketClient();
      await connectSocket(socket);
      expect(socket.connected).toBe(true);

      await disconnectSocket(socket);
      expect(socket.connected).toBe(false);
    });

    it('should allow multiple clients to connect', async () => {
      const socket1 = createSocketClient();
      const socket2 = createSocketClient();

      await connectSocket(socket1);
      await connectSocket(socket2);

      expect(socket1.connected).toBe(true);
      expect(socket2.connected).toBe(true);

      sockets.push(socket1, socket2);
    });
  });

  describe('lobby:join', () => {
    it('should allow player to join a lobby', async () => {
      // Create lobby via HTTP
      const response = await request(testServer.app).post('/api/lobby/create').expect(201);
      const { lobbyId } = response.body;
      const playerId = uuidv4();

      // Join lobby via HTTP first
      await request(testServer.app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId, playerName: 'Test Player' })
        .expect(200);

      // Connect socket
      const socket = createSocketClient();
      await connectSocket(socket);
      sockets.push(socket);

      // Join lobby via WebSocket
      const joinPromise = waitForEvent(socket, 'lobby:playerJoined');
      socket.emit('lobby:join', { lobbyId, playerId });

      const joinEvent = await joinPromise;

      expect(joinEvent.player).toBeDefined();
      expect(joinEvent.player.name).toBe('Test Player');
      expect(joinEvent.player.isLeader).toBe(true);
      expect(joinEvent.lobby).toBeDefined();
      expect(joinEvent.lobby.id).toBe(lobbyId);
    });

    it('should notify other players when someone joins', async () => {
      // Create lobby via HTTP
      const response = await request(testServer.app).post('/api/lobby/create').expect(201);
      const { lobbyId } = response.body;
      const playerId1 = uuidv4();
      const playerId2 = uuidv4();

      // Join via HTTP first
      await request(testServer.app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: playerId1, playerName: 'Player 1' })
        .expect(200);

      await request(testServer.app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: playerId2, playerName: 'Player 2' })
        .expect(200);

      // First player connects via socket
      const socket1 = createSocketClient();
      await connectSocket(socket1);
      sockets.push(socket1);

      socket1.emit('lobby:join', { lobbyId, playerId: playerId1 });
      await waitForEvent(socket1, 'lobby:playerJoined');

      // Second player connects via socket
      const socket2 = createSocketClient();
      await connectSocket(socket2);
      sockets.push(socket2);

      // Both sockets should receive the event
      const player1ReceivePromise = waitForEvent(socket1, 'lobby:playerJoined');
      const player2ReceivePromise = waitForEvent(socket2, 'lobby:playerJoined');

      socket2.emit('lobby:join', { lobbyId, playerId: playerId2 });

      const [event1, event2] = await Promise.all([
        player1ReceivePromise,
        player2ReceivePromise,
      ]);

      // Both should receive notification about Player 2 joining
      expect(event1.player.name).toBe('Player 2');
      expect(event2.player.name).toBe('Player 2');
      expect(event1.lobby.players.length).toBe(2);
    });

    it('should emit error when joining non-existent lobby', async () => {
      const socket = createSocketClient();
      await connectSocket(socket);
      sockets.push(socket);

      const errorPromise = waitForEvent(socket, 'error');
      socket.emit('lobby:join', { lobbyId: 'non-existent-lobby' });

      const error = await errorPromise;
      expect(error.message).toContain('not found');
    });

    it('should emit error when joining in-game lobby', async () => {
      // Create lobby
      const response = await request(testServer.app).post('/api/lobby/create').expect(201);
      const { lobbyId } = response.body;
      const playerId1 = uuidv4();
      const playerId2 = uuidv4();
      const playerId3 = uuidv4();

      // Join as leader
      const joinResponse1 = await request(testServer.app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: playerId1, playerName: 'Player 1' })
        .expect(200);
      const leaderId = joinResponse1.body.playerId;

      // Add second player via HTTP
      await request(testServer.app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: playerId2, playerName: 'Player 2' })
        .expect(200);

      // Start game
      await request(testServer.app)
        .post('/api/game/start')
        .send({ lobbyId, playerId: leaderId })
        .expect(200);

      // Join third player via HTTP (should fail)
      await request(testServer.app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: playerId3, playerName: 'Late Player' })
        .expect(409);

      // Try to join via WebSocket (also should fail)
      const socket = createSocketClient();
      await connectSocket(socket);
      sockets.push(socket);

      const errorPromise = waitForEvent(socket, 'error');
      socket.emit('lobby:join', { lobbyId, playerId: playerId3 });

      const error = await errorPromise;
      expect(error.message).toContain('not found');
    });
  });

  describe('lobby:leave', () => {
    it('should allow player to leave a lobby', async () => {
      // Create lobby
      const response = await request(testServer.app).post('/api/lobby/create').expect(201);
      const { lobbyId } = response.body;
      const playerId = uuidv4();

      // Join lobby via HTTP
      await request(testServer.app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId, playerName: 'Test Player' })
        .expect(200);

      // Join lobby via socket
      const socket = createSocketClient();
      await connectSocket(socket);
      sockets.push(socket);

      socket.emit('lobby:join', { lobbyId, playerId });
      await waitForEvent(socket, 'lobby:playerJoined');

      // Leave lobby
      socket.emit('lobby:leave', { lobbyId, playerId });

      // Give it time to process
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Verify lobby is empty
      const lobby = lobbyService.getLobbyState(lobbyId);
      expect(lobby).toBeNull(); // Lobby should be deleted when empty
    });

    it('should notify other players when someone leaves', async () => {
      // Create lobby
      const response = await request(testServer.app).post('/api/lobby/create').expect(201);
      const { lobbyId } = response.body;
      const playerId1 = uuidv4();
      const playerId2 = uuidv4();

      // Join via HTTP first
      await request(testServer.app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: playerId1, playerName: 'Player 1' })
        .expect(200);

      await request(testServer.app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: playerId2, playerName: 'Player 2' })
        .expect(200);

      // Two players join via socket
      const socket1 = createSocketClient();
      const socket2 = createSocketClient();
      await connectSocket(socket1);
      await connectSocket(socket2);
      sockets.push(socket1, socket2);

      socket1.emit('lobby:join', { lobbyId, playerId: playerId1 });
      await waitForEvent(socket1, 'lobby:playerJoined');

      socket2.emit('lobby:join', { lobbyId, playerId: playerId2 });
      await waitForEvent(socket2, 'lobby:playerJoined');

      // Player 2 leaves
      const leavePromise = waitForEvent(socket1, 'lobby:playerLeft');
      socket2.emit('lobby:leave', { lobbyId, playerId: playerId2 });

      // Wait briefly
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    it('should reassign leader when leader leaves', async () => {
      // Create lobby
      const response = await request(testServer.app).post('/api/lobby/create').expect(201);
      const { lobbyId } = response.body;
      const playerId1 = uuidv4();
      const playerId2 = uuidv4();

      // Join via HTTP first
      await request(testServer.app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: playerId1, playerName: 'Player 1' })
        .expect(200);

      await request(testServer.app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: playerId2, playerName: 'Player 2' })
        .expect(200);

      // Two players join via socket
      const socket1 = createSocketClient();
      const socket2 = createSocketClient();
      await connectSocket(socket1);
      await connectSocket(socket2);
      sockets.push(socket1, socket2);

      socket1.emit('lobby:join', { lobbyId, playerId: playerId1 });
      await waitForEvent(socket1, 'lobby:playerJoined');

      socket2.emit('lobby:join', { lobbyId, playerId: playerId2 });
      await waitForEvent(socket2, 'lobby:playerJoined');

      // Leader (Player 1) leaves
      const leaderChangedPromise = waitForEvent(socket2, 'lobby:leaderChanged');
      socket1.emit('lobby:leave', { lobbyId, playerId: playerId1 });

      const leaderChangedEvent = await leaderChangedPromise;
      expect(leaderChangedEvent.newLeaderId).toBe(playerId2);
    });
  });

  describe('disconnect', () => {
    it('should handle player disconnect by removing from lobby', async () => {
      // Create lobby
      const response = await request(testServer.app).post('/api/lobby/create').expect(201);
      const { lobbyId } = response.body;
      const playerId = uuidv4();

      // Join lobby via HTTP
      await request(testServer.app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId, playerName: 'Test Player' })
        .expect(200);

      // Join lobby via socket
      const socket = createSocketClient();
      await connectSocket(socket);

      socket.emit('lobby:join', { lobbyId, playerId });
      await waitForEvent(socket, 'lobby:playerJoined');

      // Disconnect
      await disconnectSocket(socket);

      // Give server time to process disconnect
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Verify lobby is empty (deleted)
      const lobby = lobbyService.getLobbyState(lobbyId);
      expect(lobby).toBeNull();
    });

    it('should notify other players when someone disconnects', async () => {
      // Create lobby
      const response = await request(testServer.app).post('/api/lobby/create').expect(201);
      const { lobbyId } = response.body;
      const playerId1 = uuidv4();
      const playerId2 = uuidv4();

      // Join via HTTP first
      await request(testServer.app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: playerId1, playerName: 'Player 1' })
        .expect(200);

      await request(testServer.app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: playerId2, playerName: 'Player 2' })
        .expect(200);

      // Two players join via socket
      const socket1 = createSocketClient();
      const socket2 = createSocketClient();
      await connectSocket(socket1);
      await connectSocket(socket2);
      sockets.push(socket2); // Keep socket2 for cleanup

      socket1.emit('lobby:join', { lobbyId, playerId: playerId1 });
      await waitForEvent(socket1, 'lobby:playerJoined');

      socket2.emit('lobby:join', { lobbyId, playerId: playerId2 });
      await waitForEvent(socket2, 'lobby:playerJoined');

      // Player 1 disconnects
      const playerLeftPromise = waitForEvent(socket2, 'lobby:playerLeft');
      await disconnectSocket(socket1);

      const playerLeftEvent = await playerLeftPromise;
      expect(playerLeftEvent.lobby.players.length).toBe(1);
    });
  });
});
