/**
 * Integration tests for game endpoints
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { Server } from 'http';
import { createTestServer, closeTestServer, TestServer } from '../setup';
import { lobbyService } from '../../../src/services/lobbyService';
import { StartGameResponse } from '@hilo/shared';

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

  beforeEach(() => {
    // Clear all lobbies before each test
    lobbyService.clearAll();
  });

  describe('POST /api/game/start', () => {
    it('should start game when leader with 2+ players', async () => {
      // Create lobby
      const createResponse = await request(app)
        .post('/api/lobby/create')
        .expect(201);

      const lobbyId = createResponse.body.lobbyId;

      // Join as leader
      const joinResponse1 = await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerName: 'Alice' })
        .expect(200);

      const leaderId = joinResponse1.body.playerId;

      // Join as second player
      await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerName: 'Bob' })
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

      const joinResponse1 = await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerName: 'Alice' })
        .expect(200);

      const leaderId = joinResponse1.body.playerId;

      await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerName: 'Bob' })
        .expect(200);

      // Start game
      await request(app)
        .post('/api/game/start')
        .send({ lobbyId, playerId: leaderId })
        .expect(200);

      // Verify lobby status changed
      const lobby = lobbyService.getLobby(lobbyId);
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

      // First player (leader)
      await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerName: 'Alice' })
        .expect(200);

      // Second player (not leader)
      const joinResponse2 = await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerName: 'Bob' })
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

      // Join as only player
      const joinResponse = await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerName: 'Alice' })
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

    it('should return 409 if game already started', async () => {
      // Create lobby with players
      const createResponse = await request(app)
        .post('/api/lobby/create')
        .expect(201);

      const lobbyId = createResponse.body.lobbyId;

      const joinResponse1 = await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerName: 'Alice' })
        .expect(200);

      const leaderId = joinResponse1.body.playerId;

      await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerName: 'Bob' })
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
});
