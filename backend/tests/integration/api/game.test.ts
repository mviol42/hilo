/**
 * Integration tests for game endpoints
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { Server } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { createTestServer, closeTestServer, TestServer } from '../setup';
import { lobbyService } from '../../../src/services/lobbyService';
import { gameService } from '../../../src/services/gameService';
import { StartGameResponse, PlayAgainResponse } from '@hilo/shared';

describe('Game API', () => {
  let testServer: TestServer;
  let app: Express;
  let server: Server;

  beforeAll(async () => {
    testServer = await createTestServer();
    app = testServer.app;
    server = testServer.server;
  });

  afterAll(async () => {
    await closeTestServer(testServer);
  });

  beforeEach(async () => {
    // Clear all lobbies before each test
    await lobbyService.clearAll();
  });

  describe('POST /api/game/start', () => {
    it('should start game when leader with 2+ players', async () => {
      // Create lobby
      const createResponse = await request(app)
        .post('/api/lobby/create')
        .expect(201);

      const lobbyId = createResponse.body.lobbyId;
      const playerId1 = uuidv4();
      const playerId2 = uuidv4();

      // Join as leader
      const joinResponse1 = await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: playerId1, playerName: 'Alice' })
        .expect(200);

      const leaderId = joinResponse1.body.playerId;

      // Join as second player
      const joinResponse2 = await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: playerId2, playerName: 'Bob' })
        .expect(200);

      // Player 2 marks as ready
      await request(app)
        .post('/api/lobby/ready')
        .send({ lobbyId, playerId: playerId2 })
        .expect(200);

      // Start game
      const response = await request(app)
        .post('/api/game/start')
        .send({ lobbyId, playerId: leaderId })
        .expect(200)
        .expect('Content-Type', /json/);

      const body = response.body as StartGameResponse;

      expect(body.gameState).toBeDefined();
      expect(body.gameState.id).toBeDefined();
      // Game ID is a UUID v4
      expect(body.gameState.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(body.gameState.phase).toBe('setup');
      expect(body.gameState.activePlayerId).toBeDefined();
    });

    it('should transition lobby to in_game status', async () => {
      // Create lobby with players
      const createResponse = await request(app)
        .post('/api/lobby/create')
        .expect(201);

      const lobbyId = createResponse.body.lobbyId;
      const playerId1 = uuidv4();
      const playerId2 = uuidv4();

      const joinResponse1 = await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: playerId1, playerName: 'Alice' })
        .expect(200);

      const leaderId = joinResponse1.body.playerId;

      await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: playerId2, playerName: 'Bob' })
        .expect(200);

      // Player 2 marks as ready
      await request(app)
        .post('/api/lobby/ready')
        .send({ lobbyId, playerId: playerId2 })
        .expect(200);

      // Start game
      await request(app)
        .post('/api/game/start')
        .send({ lobbyId, playerId: leaderId })
        .expect(200);

      // Verify lobby status changed
      const lobby = await lobbyService.getLobby(lobbyId);
      expect(lobby?.status).toBe('in_game');
    });

    it('should return 400 if lobbyId is missing', async () => {
      const response = await request(app)
        .post('/api/game/start')
        .send({ playerId: 'some-id' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('required');
    });

    it('should return 400 if playerId is missing', async () => {
      const response = await request(app)
        .post('/api/game/start')
        .send({ lobbyId: 'some-id' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('required');
    });

    it('should return 404 for non-existent lobby', async () => {
      const response = await request(app)
        .post('/api/game/start')
        .send({ lobbyId: 'non-existent-id', playerId: 'player-id' })
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('not found');
    });

    it('should return 403 if not the leader', async () => {
      // Create lobby with players
      const createResponse = await request(app)
        .post('/api/lobby/create')
        .expect(201);

      const lobbyId = createResponse.body.lobbyId;
      const playerId1 = uuidv4();
      const playerId2 = uuidv4();

      // First player (leader)
      await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: playerId1, playerName: 'Alice' })
        .expect(200);

      // Second player (not leader)
      const joinResponse2 = await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: playerId2, playerName: 'Bob' })
        .expect(200);

      const nonLeaderId = joinResponse2.body.playerId;

      // Try to start game as non-leader
      const response = await request(app)
        .post('/api/game/start')
        .send({ lobbyId, playerId: nonLeaderId })
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('leader');
    });

    it('should return 400 with less than 2 players', async () => {
      // Create lobby
      const createResponse = await request(app)
        .post('/api/lobby/create')
        .expect(201);

      const lobbyId = createResponse.body.lobbyId;
      const playerId = uuidv4();

      // Join as only player
      const joinResponse = await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId, playerName: 'Alice' })
        .expect(200);

      const leaderId = joinResponse.body.playerId;

      // Try to start game with only 1 player
      const response = await request(app)
        .post('/api/game/start')
        .send({ lobbyId, playerId: leaderId })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('at least 2 players');
    });

    it('should return 400 if not all players are ready', async () => {
      // Create lobby with players
      const createResponse = await request(app)
        .post('/api/lobby/create')
        .expect(201);

      const lobbyId = createResponse.body.lobbyId;
      const playerId1 = uuidv4();
      const playerId2 = uuidv4();

      const joinResponse1 = await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: playerId1, playerName: 'Alice' })
        .expect(200);

      const leaderId = joinResponse1.body.playerId;

      await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: playerId2, playerName: 'Bob' })
        .expect(200);

      // Try to start game without player 2 being ready
      const response = await request(app)
        .post('/api/game/start')
        .send({ lobbyId, playerId: leaderId })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('Players are not ready');
    });

    it('should return 409 if game already started', async () => {
      // Create lobby with players
      const createResponse = await request(app)
        .post('/api/lobby/create')
        .expect(201);

      const lobbyId = createResponse.body.lobbyId;
      const playerId1 = uuidv4();
      const playerId2 = uuidv4();

      const joinResponse1 = await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: playerId1, playerName: 'Alice' })
        .expect(200);

      const leaderId = joinResponse1.body.playerId;

      await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: playerId2, playerName: 'Bob' })
        .expect(200);

      // Player 2 marks as ready
      await request(app)
        .post('/api/lobby/ready')
        .send({ lobbyId, playerId: playerId2 })
        .expect(200);

      // Start game once
      await request(app)
        .post('/api/game/start')
        .send({ lobbyId, playerId: leaderId })
        .expect(200);

      // Try to start again
      const response = await request(app)
        .post('/api/game/start')
        .send({ lobbyId, playerId: leaderId })
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('already started');
    });
  });

  describe('POST /api/game/play-again', () => {
    /**
     * Helper to create a game that has ended
     */
    async function createEndedGame(): Promise<{ gameId: string; lobbyId: string; playerId1: string; playerId2: string }> {
      // Create lobby
      const createResponse = await request(app)
        .post('/api/lobby/create')
        .expect(201);

      const lobbyId = createResponse.body.lobbyId;
      const playerId1 = uuidv4();
      const playerId2 = uuidv4();

      // Join players
      await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: playerId1, playerName: 'Alice' })
        .expect(200);

      await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: playerId2, playerName: 'Bob' })
        .expect(200);

      // Ready player 2
      await request(app)
        .post('/api/lobby/ready')
        .send({ lobbyId, playerId: playerId2 })
        .expect(200);

      // Start game
      const startResponse = await request(app)
        .post('/api/game/start')
        .send({ lobbyId, playerId: playerId1 })
        .expect(200);

      const gameId = startResponse.body.gameState.id;

      // Manually set game to ended state for testing
      const game = await gameService.getGame(gameId);
      if (game) {
        game.phase = 'ended';
        game.winner = playerId1;
        await gameService.updateGame(gameId, game);
      }

      return { gameId, lobbyId, playerId1, playerId2 };
    }

    it('should create a new lobby for play again', async () => {
      const { gameId } = await createEndedGame();

      const response = await request(app)
        .post('/api/game/play-again')
        .send({ gameId })
        .expect(200)
        .expect('Content-Type', /json/);

      const body = response.body as PlayAgainResponse;

      expect(body.lobbyId).toBeDefined();
      expect(body.lobbyId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

      // Verify the lobby exists
      const lobby = await lobbyService.getLobby(body.lobbyId);
      expect(lobby).not.toBeNull();
      expect(lobby?.status).toBe('waiting');
    });

    it('should return the same lobby ID for multiple play-again requests', async () => {
      const { gameId } = await createEndedGame();

      // First request
      const response1 = await request(app)
        .post('/api/game/play-again')
        .send({ gameId })
        .expect(200);

      // Second request
      const response2 = await request(app)
        .post('/api/game/play-again')
        .send({ gameId })
        .expect(200);

      // Should get the same lobby ID (idempotent)
      expect(response1.body.lobbyId).toBe(response2.body.lobbyId);
    });

    it('should return 400 if gameId is missing', async () => {
      const response = await request(app)
        .post('/api/game/play-again')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('gameId is required');
    });

    it('should return 404 for non-existent game', async () => {
      const response = await request(app)
        .post('/api/game/play-again')
        .send({ gameId: 'non-existent-game-id' })
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('Game not found');
    });

    it('should return 400 if game has not ended', async () => {
      // Create a game that is still in progress
      const createResponse = await request(app)
        .post('/api/lobby/create')
        .expect(201);

      const lobbyId = createResponse.body.lobbyId;
      const playerId1 = uuidv4();
      const playerId2 = uuidv4();

      await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: playerId1, playerName: 'Alice' })
        .expect(200);

      await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: playerId2, playerName: 'Bob' })
        .expect(200);

      await request(app)
        .post('/api/lobby/ready')
        .send({ lobbyId, playerId: playerId2 })
        .expect(200);

      const startResponse = await request(app)
        .post('/api/game/start')
        .send({ lobbyId, playerId: playerId1 })
        .expect(200);

      const gameId = startResponse.body.gameState.id;

      // Try to play again while game is still in setup phase
      const response = await request(app)
        .post('/api/game/play-again')
        .send({ gameId })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('Game has not ended yet');
    });

    it('should allow players to join the play-again lobby', async () => {
      const { gameId, playerId1, playerId2 } = await createEndedGame();

      // Get the play-again lobby
      const response = await request(app)
        .post('/api/game/play-again')
        .send({ gameId })
        .expect(200);

      const newLobbyId = response.body.lobbyId;

      // Players can join the new lobby
      const joinResponse1 = await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId: newLobbyId, playerId: playerId1, playerName: 'Alice' })
        .expect(200);

      expect(joinResponse1.body.isLeader).toBe(true); // First to join becomes leader

      const joinResponse2 = await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId: newLobbyId, playerId: playerId2, playerName: 'Bob' })
        .expect(200);

      expect(joinResponse2.body.isLeader).toBe(false);

      // Verify lobby has both players
      const lobby = await lobbyService.getLobby(newLobbyId);
      expect(lobby?.players.size).toBe(2);
    });
  });
});
