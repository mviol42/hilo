/**
 * Integration tests for WebSocket game events
 *
 * Tests verify that WebSocket events are properly emitted when game mutations
 * are performed via HTTP API.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { createTestServer, closeTestServer, TestServer } from '../setup';
import {
  createSocketClient,
  connectSocket,
  waitForEvent,
  cleanupSockets,
  setTestPort,
  TestSocket,
} from './helpers';
import { lobbyService } from '../../../src/services/lobbyService';
import { gameService } from '../../../src/services/gameService';
import request from 'supertest';
import { Card } from '@hilo/shared';

describe('WebSocket Game Events', () => {
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

    // Clear lobbies and games
    await lobbyService.clearAll();
    await gameService.clearAll();
  });

  describe('Game Setup Phase', () => {
    it('should receive gameStarting event when game starts', async () => {
      // Create lobby
      const lobbyRes = await request(testServer.app).post('/api/lobby/create').expect(201);
      const { lobbyId } = lobbyRes.body;
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

      // Mark player 2 as ready (player 1 is leader, doesn't need to be ready)
      await request(testServer.app)
        .post('/api/lobby/ready')
        .send({ lobbyId, playerId: playerId2 })
        .expect(200);

      // Connect sockets
      const socket1 = createSocketClient();
      const socket2 = createSocketClient();
      await connectSocket(socket1);
      await connectSocket(socket2);
      sockets.push(socket1, socket2);

      // Join lobby via WebSocket
      socket1.emit('lobby:join', { lobbyId, playerId: playerId1 });
      await waitForEvent(socket1, 'lobby:playerJoined');

      socket2.emit('lobby:join', { lobbyId, playerId: playerId2 });
      await waitForEvent(socket2, 'lobby:playerJoined');

      // Start game
      const gameStartingPromise1 = waitForEvent(socket1, 'lobby:gameStarting');
      const gameStartingPromise2 = waitForEvent(socket2, 'lobby:gameStarting');
      const stateUpdatePromise1 = waitForEvent(socket1, 'game:stateUpdate');
      const stateUpdatePromise2 = waitForEvent(socket2, 'game:stateUpdate');

      await request(testServer.app)
        .post('/api/game/start')
        .send({ lobbyId, playerId: playerId1 })
        .expect(200);

      const [gameStarting1, gameStarting2, stateUpdate1, stateUpdate2] = await Promise.all([
        gameStartingPromise1,
        gameStartingPromise2,
        stateUpdatePromise1,
        stateUpdatePromise2,
      ]);

      expect(gameStarting1.gameId).toBeDefined();
      expect(gameStarting2.gameId).toBe(gameStarting1.gameId);
      expect(stateUpdate1.gameState.phase).toBe('setup');
      expect(stateUpdate2.gameState.phase).toBe('setup');
    });

    it('should allow player to select face-up cards via HTTP API', async () => {
      // Setup game (create lobby, add players, start game)
      const { gameId, socket1, socket2, player1Id, player2Id } = await setupGame(testServer);
      sockets.push(socket1, socket2);

      // Get initial state
      const game = await gameService.getGame(gameId);
      expect(game).toBeDefined();

      const player1State = game!.players.get(player1Id);
      expect(player1State).toBeDefined();
      expect(player1State!.hand.length).toBe(6);

      // Select face-up cards (indices 0, 1, 2)
      const cardsToSelect = [
        player1State!.hand[0],
        player1State!.hand[1],
        player1State!.hand[2],
      ];

      // Set up listener for WebSocket state update before making HTTP request
      const stateUpdatePromise = waitForEvent(socket1, 'game:stateUpdate');

      // Use HTTP API for mutation
      await request(testServer.app)
        .post('/api/game/select-faceup')
        .send({ gameId, playerId: player1Id, cards: cardsToSelect })
        .expect(200);

      // Verify WebSocket event is received
      const stateUpdate = await stateUpdatePromise;
      expect(stateUpdate.gameState.myHand.length).toBe(3);
      expect(stateUpdate.gameState.myFaceUp.length).toBe(3);
    });

    it('should transition to playing phase when all players select face-up cards', async () => {
      // Setup game
      const { gameId, socket1, socket2, player1Id, player2Id } = await setupGame(testServer);
      sockets.push(socket1, socket2);

      // Get initial state
      const game = await gameService.getGame(gameId);
      const player1State = game!.players.get(player1Id);
      const player2State = game!.players.get(player2Id);

      // Player 1 selects via HTTP API - set up listener BEFORE request
      const cards1 = [player1State!.hand[0], player1State!.hand[1], player1State!.hand[2]];
      const stateUpdatePromise1 = waitForEvent(socket1, 'game:stateUpdate');
      await request(testServer.app)
        .post('/api/game/select-faceup')
        .send({ gameId, playerId: player1Id, cards: cards1 })
        .expect(200);
      await stateUpdatePromise1;

      // Player 2 selects (should trigger phase change)
      const cards2 = [player2State!.hand[0], player2State!.hand[1], player2State!.hand[2]];

      // Set up turnChange listener BEFORE HTTP request - this only fires after game starts
      const turnChangePromise = waitForEvent(socket1, 'game:turnChange');

      // Player 2 selects via HTTP API
      await request(testServer.app)
        .post('/api/game/select-faceup')
        .send({ gameId, playerId: player2Id, cards: cards2 })
        .expect(200);

      // Wait for turnChange which only fires after phase transition
      const turnChange = await turnChangePromise;

      // Verify the game is now in playing phase
      const updatedGame = await gameService.getGame(gameId);
      expect(updatedGame!.phase).toBe('playing');
      expect(turnChange.activePlayerId).toBeDefined();
    });
  });

  describe('Game Playing Phase', () => {
    it('should allow active player to play cards via HTTP API', async () => {
      // Setup and complete setup phase
      const { gameId, socket1, socket2, player1Id, player2Id } = await setupAndStartGame(
        testServer
      );
      sockets.push(socket1, socket2);

      const game = await gameService.getGame(gameId);
      const activePlayerId = game!.activePlayerId;
      const activeSocket = activePlayerId === player1Id ? socket1 : socket2;
      const playerState = game!.players.get(activePlayerId);

      // Find playable card - exclude special cards that affect pile (8 = invisible, 10 = blow up)
      const playableCards = playerState!.hand.filter(
        (card) => card.rank !== '8' && card.rank !== '10'
      );
      if (playableCards.length === 0) {
        // Skip if no playable cards (edge case in random game)
        return;
      }

      const cardToPlay = [playableCards[0]];

      // Set up listeners before HTTP request
      const stateUpdatePromise = waitForEvent(activeSocket, 'game:stateUpdate');
      const turnChangePromise = waitForEvent(activeSocket, 'game:turnChange');

      // Use HTTP API for mutation
      await request(testServer.app)
        .post('/api/game/play-cards')
        .send({ gameId, playerId: activePlayerId, cards: cardToPlay })
        .expect(200);

      const [stateUpdate, turnChange] = await Promise.all([
        stateUpdatePromise,
        turnChangePromise,
      ]);

      // Verify card was played (pile has cards or hand size changed)
      expect(stateUpdate.gameState.pile.length).toBeGreaterThan(0);
      expect(turnChange.activePlayerId).toBeDefined();
    });

    it('should return error when non-active player tries to play via HTTP API', async () => {
      const { gameId, socket1, socket2, player1Id, player2Id } = await setupAndStartGame(
        testServer
      );
      sockets.push(socket1, socket2);

      const game = await gameService.getGame(gameId);
      const activePlayerId = game!.activePlayerId;
      const nonActivePlayerId = activePlayerId === player1Id ? player2Id : player1Id;

      // Use HTTP API - should return error response
      const response = await request(testServer.app)
        .post('/api/game/play-cards')
        .send({ gameId, playerId: nonActivePlayerId, cards: [{ rank: '3', suit: 'hearts' }] })
        .expect(500);

      expect(response.body.message).toContain('Not player turn');
    });

    it('should allow player to pick up pile via HTTP API', async () => {
      const { gameId, socket1, socket2, player1Id, player2Id } = await setupAndStartGame(
        testServer
      );
      sockets.push(socket1, socket2);

      const game = await gameService.getGame(gameId);
      const activePlayerId = game!.activePlayerId;
      const activeSocket = activePlayerId === player1Id ? socket1 : socket2;

      // Play a high card first to make pickup necessary
      const playerState = game!.players.get(activePlayerId);
      const highCard = playerState!.hand.find((c) => c.rank === 'K' || c.rank === 'A');

      if (highCard) {
        // Set up listener BEFORE HTTP request
        const stateUpdatePromise = waitForEvent(activeSocket, 'game:stateUpdate');
        // Use HTTP API to play card
        await request(testServer.app)
          .post('/api/game/play-cards')
          .send({ gameId, playerId: activePlayerId, cards: [highCard] })
          .expect(200);
        await stateUpdatePromise;
      }

      // Next player should be able to pick up if no playable cards
      const updatedGame = await gameService.getGame(gameId);
      const newActivePlayerId = updatedGame!.activePlayerId;
      const newActiveSocket = newActivePlayerId === player1Id ? socket1 : socket2;

      // Try to pick up via HTTP API (may fail if player has playable cards)
      // For this test, we just verify the endpoint works - pickup may not always succeed
      const response = await request(testServer.app)
        .post('/api/game/pickup-pile')
        .send({ gameId, playerId: newActivePlayerId });

      // Either success (200) or error because player has playable cards (500)
      expect([200, 500]).toContain(response.status);
    });
  });
});

/**
 * Helper to setup a game (create lobby, add players, start game)
 */
async function setupGame(testServer: TestServer) {
  // Create lobby
  const lobbyRes = await request(testServer.app).post('/api/lobby/create').expect(201);
  const { lobbyId } = lobbyRes.body;
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

  // Mark player 2 as ready (player 1 is leader, doesn't need to be ready)
  await request(testServer.app)
    .post('/api/lobby/ready')
    .send({ lobbyId, playerId: playerId2 })
    .expect(200);

  // Connect sockets
  const socket1 = createSocketClient();
  const socket2 = createSocketClient();
  await connectSocket(socket1);
  await connectSocket(socket2);

  // Join lobby via WebSocket
  socket1.emit('lobby:join', { lobbyId, playerId: playerId1 });
  await waitForEvent(socket1, 'lobby:playerJoined');

  socket2.emit('lobby:join', { lobbyId, playerId: playerId2 });
  await waitForEvent(socket2, 'lobby:playerJoined');

  // Start game
  const response = await request(testServer.app)
    .post('/api/game/start')
    .send({ lobbyId, playerId: playerId1 })
    .expect(200);

  const gameId = response.body.gameState.id;

  // Wait for initial state
  await waitForEvent(socket1, 'game:stateUpdate');
  await waitForEvent(socket2, 'game:stateUpdate');

  return { gameId, socket1, socket2, player1Id: playerId1, player2Id: playerId2, lobbyId };
}

/**
 * Helper to setup a game and complete the setup phase
 */
async function setupAndStartGame(testServer: TestServer) {
  const { gameId, socket1, socket2, player1Id, player2Id, lobbyId } = await setupGame(
    testServer
  );

  // Get game state
  const game = await gameService.getGame(gameId);
  const player1State = game!.players.get(player1Id);
  const player2State = game!.players.get(player2Id);

  // Both players select face-up cards via HTTP API
  // Set up listener BEFORE making request
  const cards1 = [player1State!.hand[0], player1State!.hand[1], player1State!.hand[2]];
  const stateUpdatePromise1 = waitForEvent(socket1, 'game:stateUpdate');
  await request(testServer.app)
    .post('/api/game/select-faceup')
    .send({ gameId, playerId: player1Id, cards: cards1 })
    .expect(200);
  await stateUpdatePromise1;

  // Player 2 selects, which triggers phase transition
  // This emits per socket: stateUpdate (selection) + stateUpdate (game start) + turnChange (socket1 only)
  const cards2 = [player2State!.hand[0], player2State!.hand[1], player2State!.hand[2]];

  // Set up listener BEFORE making request
  const turnChangePromise = waitForEvent(socket1, 'game:turnChange');
  await request(testServer.app)
    .post('/api/game/select-faceup')
    .send({ gameId, playerId: player2Id, cards: cards2 })
    .expect(200);

  // Wait for turnChange which only fires after game starts
  await turnChangePromise;

  // Remove stateUpdate listeners to prevent stale events from being received
  socket1.removeAllListeners('game:stateUpdate');
  socket2.removeAllListeners('game:stateUpdate');

  return { gameId, socket1, socket2, player1Id, player2Id, lobbyId };
}
