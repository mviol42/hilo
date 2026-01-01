/**
 * Integration tests for game reconnection flow
 *
 * Tests that players can reconnect to a game in progress and receive
 * their game state via game:requestState
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
  setTestPort,
  TestSocket,
} from './helpers';
import { lobbyService } from '../../../src/services/lobbyService';
import { gameService } from '../../../src/services/gameService';
import request from 'supertest';

describe('Game Reconnection', () => {
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
    await cleanupSockets(sockets);
    sockets = [];
    await lobbyService.clearAll();
    await gameService.clearAll();
  });

  /**
   * Helper to set up a game with two players
   */
  async function setupGameWithTwoPlayers() {
    const player1Id = uuidv4();
    const player2Id = uuidv4();

    // Create lobby
    const createResponse = await request(testServer.app)
      .post('/api/lobby/create')
      .expect(201);
    const { lobbyId } = createResponse.body;

    // Join players
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
    const startResponse = await request(testServer.app)
      .post('/api/game/start')
      .send({ lobbyId, playerId: player1Id })
      .expect(200);

    const { gameState } = startResponse.body;

    return { lobbyId, player1Id, player2Id, gameId: gameState.id };
  }

  describe('Players remain in lobby during game', () => {
    it('should keep lobby status as in_game when game starts', async () => {
      const { lobbyId } = await setupGameWithTwoPlayers();

      const lobby = await lobbyService.getLobby(lobbyId);
      expect(lobby).not.toBeNull();
      expect(lobby?.status).toBe('in_game');
    });

    it('should keep both players in lobby when game is in progress', async () => {
      const { lobbyId, player1Id, player2Id } = await setupGameWithTwoPlayers();

      const lobby = await lobbyService.getLobby(lobbyId);
      expect(lobby?.players.has(player1Id)).toBe(true);
      expect(lobby?.players.has(player2Id)).toBe(true);
    });

    it('should not remove player from lobby on disconnect during game', async () => {
      const { lobbyId, player1Id, player2Id } = await setupGameWithTwoPlayers();

      // Connect sockets
      const socket1 = createSocketClient();
      const socket2 = createSocketClient();
      await connectSocket(socket1);
      await connectSocket(socket2);
      sockets.push(socket1, socket2);

      // Join lobby room
      socket1.emit('lobby:join', { lobbyId, playerId: player1Id });
      await waitForEvent(socket1, 'lobby:playerJoined');

      socket2.emit('lobby:join', { lobbyId, playerId: player2Id });
      await waitForEvent(socket2, 'lobby:playerJoined');

      // Disconnect player2
      await disconnectSocket(socket2);
      sockets = sockets.filter(s => s !== socket2);

      // Player2 should still be in lobby
      const lobby = await lobbyService.getLobby(lobbyId);
      expect(lobby?.players.has(player2Id)).toBe(true);
      expect(lobby?.status).toBe('in_game');
    });
  });

  describe('game:requestState for reconnection', () => {
    it('should return game state when player requests it after reconnect', async () => {
      const { lobbyId, player1Id, player2Id, gameId } = await setupGameWithTwoPlayers();

      // Connect player1 socket
      const socket1 = createSocketClient();
      await connectSocket(socket1);
      sockets.push(socket1);

      // Join lobby room
      socket1.emit('lobby:join', { lobbyId, playerId: player1Id });
      await waitForEvent(socket1, 'lobby:playerJoined');

      // Request game state
      const statePromise = waitForEvent(socket1, 'game:stateUpdate');
      socket1.emit('game:requestState', { gameId, playerId: player1Id });

      const stateEvent = await statePromise;
      expect(stateEvent.gameState).toBeDefined();
      expect(stateEvent.gameState.id).toBe(gameId);
      expect(stateEvent.gameState.phase).toBe('setup');
    });

    it('should include stateVersion for idempotent recovery', async () => {
      const { lobbyId, player1Id, gameId } = await setupGameWithTwoPlayers();

      const socket1 = createSocketClient();
      await connectSocket(socket1);
      sockets.push(socket1);

      socket1.emit('lobby:join', { lobbyId, playerId: player1Id });
      await waitForEvent(socket1, 'lobby:playerJoined');

      const statePromise = waitForEvent(socket1, 'game:stateUpdate');
      socket1.emit('game:requestState', { gameId, playerId: player1Id });

      const stateEvent = await statePromise;
      expect(stateEvent.gameState.stateVersion).toBeDefined();
      expect(typeof stateEvent.gameState.stateVersion).toBe('number');
      expect(stateEvent.gameState.stateVersion).toBeGreaterThanOrEqual(0);
    });

    it('should return personalized player view (hidden opponent cards)', async () => {
      const { lobbyId, player1Id, player2Id, gameId } = await setupGameWithTwoPlayers();

      const socket1 = createSocketClient();
      await connectSocket(socket1);
      sockets.push(socket1);

      socket1.emit('lobby:join', { lobbyId, playerId: player1Id });
      await waitForEvent(socket1, 'lobby:playerJoined');

      const statePromise = waitForEvent(socket1, 'game:stateUpdate');
      socket1.emit('game:requestState', { gameId, playerId: player1Id });

      const stateEvent = await statePromise;

      // Should have my hand visible
      expect(stateEvent.gameState.myHand).toBeDefined();
      expect(Array.isArray(stateEvent.gameState.myHand)).toBe(true);

      // Should have otherPlayers with hidden hand info (only handCount, not actual cards)
      expect(stateEvent.gameState.otherPlayers).toBeDefined();
      expect(stateEvent.gameState.otherPlayers[player2Id]).toBeDefined();
      expect(stateEvent.gameState.otherPlayers[player2Id].handCount).toBeDefined();
      // Other players' hand should not be visible (only count)
      expect(stateEvent.gameState.otherPlayers[player2Id].hand).toBeUndefined();
    });

    it('should return error for invalid game ID', async () => {
      const { lobbyId, player1Id } = await setupGameWithTwoPlayers();

      const socket1 = createSocketClient();
      await connectSocket(socket1);
      sockets.push(socket1);

      socket1.emit('lobby:join', { lobbyId, playerId: player1Id });
      await waitForEvent(socket1, 'lobby:playerJoined');

      const errorPromise = waitForEvent(socket1, 'error');
      socket1.emit('game:requestState', { gameId: 'invalid-game-id', playerId: player1Id });

      const errorEvent = await errorPromise;
      expect(errorEvent.message).toContain('not found');
    });

    it('should return error for player not in game', async () => {
      const { lobbyId, player1Id, gameId } = await setupGameWithTwoPlayers();

      const socket1 = createSocketClient();
      await connectSocket(socket1);
      sockets.push(socket1);

      socket1.emit('lobby:join', { lobbyId, playerId: player1Id });
      await waitForEvent(socket1, 'lobby:playerJoined');

      const errorPromise = waitForEvent(socket1, 'error');
      socket1.emit('game:requestState', { gameId, playerId: 'not-in-game' });

      const errorEvent = await errorPromise;
      expect(errorEvent.message).toContain('not found');
    });
  });

  describe('Full reconnection flow', () => {
    it('should allow player to rejoin lobby and request game state after disconnect', async () => {
      const { lobbyId, player1Id, player2Id, gameId } = await setupGameWithTwoPlayers();

      // Connect both players
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

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 50));

      // Reconnect player2 with new socket
      const socket2Reconnect = createSocketClient();
      await connectSocket(socket2Reconnect);
      sockets.push(socket2Reconnect);

      // Rejoin lobby
      socket2Reconnect.emit('lobby:join', { lobbyId, playerId: player2Id });
      await waitForEvent(socket2Reconnect, 'lobby:playerJoined');

      // Request game state
      const statePromise = waitForEvent(socket2Reconnect, 'game:stateUpdate');
      socket2Reconnect.emit('game:requestState', { gameId, playerId: player2Id });

      const stateEvent = await statePromise;
      expect(stateEvent.gameState).toBeDefined();
      expect(stateEvent.gameState.id).toBe(gameId);

      // Verify player2 can see their own hand
      expect(stateEvent.gameState.myHand).toBeDefined();
    });

    it('should allow multiple reconnections', async () => {
      const { lobbyId, player1Id, gameId } = await setupGameWithTwoPlayers();

      // First connection
      let socket = createSocketClient();
      await connectSocket(socket);
      socket.emit('lobby:join', { lobbyId, playerId: player1Id });
      await waitForEvent(socket, 'lobby:playerJoined');

      // First disconnect
      await disconnectSocket(socket);

      // Second connection
      socket = createSocketClient();
      await connectSocket(socket);
      socket.emit('lobby:join', { lobbyId, playerId: player1Id });
      await waitForEvent(socket, 'lobby:playerJoined');

      // Second disconnect
      await disconnectSocket(socket);

      // Third connection
      socket = createSocketClient();
      await connectSocket(socket);
      sockets.push(socket);
      socket.emit('lobby:join', { lobbyId, playerId: player1Id });
      await waitForEvent(socket, 'lobby:playerJoined');

      // Request game state
      const statePromise = waitForEvent(socket, 'game:stateUpdate');
      socket.emit('game:requestState', { gameId, playerId: player1Id });

      const stateEvent = await statePromise;
      expect(stateEvent.gameState.id).toBe(gameId);
    });
  });
});
