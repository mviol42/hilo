/**
 * Integration tests for lobby endpoints
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { Server } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { createTestServer, closeTestServer, TestServer } from '../setup';
import { lobbyService } from '../../../src/services/lobbyService';
import { CreateLobbyResponse, JoinLobbyResponse, LobbyStatusResponse } from '@hilo/shared';

describe('Lobby API', () => {
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

  describe('POST /api/lobby/create', () => {
    it('should create new lobby and return lobby ID', async () => {
      const response = await request(app)
        .post('/api/lobby/create')
        .expect(201)
        .expect('Content-Type', /json/);

      expect(response.body).toHaveProperty('lobbyId');
      expect(response.body.lobbyId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

      const body = response.body as CreateLobbyResponse;
      expect(body.lobbyId).toBeDefined();
    });

    it('should create multiple unique lobbies', async () => {
      const response1 = await request(app)
        .post('/api/lobby/create')
        .expect(201);

      const response2 = await request(app)
        .post('/api/lobby/create')
        .expect(201);

      expect(response1.body.lobbyId).not.toBe(response2.body.lobbyId);
    });

    it('should return valid JSON response', async () => {
      const response = await request(app)
        .post('/api/lobby/create')
        .expect(201);

      expect(() => JSON.stringify(response.body)).not.toThrow();
    });
  });

  describe('POST /api/lobby/join', () => {
    it('should join existing lobby with player name', async () => {
      // Create lobby first
      const createResponse = await request(app)
        .post('/api/lobby/create')
        .expect(201);

      const lobbyId = createResponse.body.lobbyId;
      const playerId = uuidv4();

      // Join lobby
      const response = await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId, playerName: 'Alice' })
        .expect(200)
        .expect('Content-Type', /json/);

      const body = response.body as JoinLobbyResponse;

      expect(body.playerId).toBe(playerId);
      expect(body.isLeader).toBe(true);
      expect(body.lobby).toBeDefined();
      expect(body.lobby.id).toBe(lobbyId);
      expect(body.lobby.players).toHaveLength(1);
      expect(body.lobby.players[0].name).toBe('Alice');
      expect(body.lobby.status).toBe('waiting');
    });

    it('should make first player the leader', async () => {
      const createResponse = await request(app)
        .post('/api/lobby/create')
        .expect(201);

      const lobbyId = createResponse.body.lobbyId;
      const playerId = uuidv4();

      const response = await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId, playerName: 'Alice' })
        .expect(200);

      expect(response.body.isLeader).toBe(true);
      expect(response.body.lobby.leaderId).toBe(response.body.playerId);
    });

    it('should not make second player the leader', async () => {
      const createResponse = await request(app)
        .post('/api/lobby/create')
        .expect(201);

      const lobbyId = createResponse.body.lobbyId;
      const playerId1 = uuidv4();
      const playerId2 = uuidv4();

      // First player joins
      await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: playerId1, playerName: 'Alice' })
        .expect(200);

      // Second player joins
      const response = await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: playerId2, playerName: 'Bob' })
        .expect(200);

      expect(response.body.isLeader).toBe(false);
      expect(response.body.lobby.players).toHaveLength(2);
    });

    it('should use default name if not provided', async () => {
      const createResponse = await request(app)
        .post('/api/lobby/create')
        .expect(201);

      const lobbyId = createResponse.body.lobbyId;
      const playerId = uuidv4();

      const response = await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId })
        .expect(200);

      expect(response.body.lobby.players[0].name).toBe('Player 1');
    });

    it('should return 400 if lobbyId is missing', async () => {
      const response = await request(app)
        .post('/api/lobby/join')
        .send({ playerName: 'Alice' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('lobbyId');
    });

    it('should return 404 for non-existent lobby', async () => {
      const playerId = uuidv4();
      const nonExistentLobbyId = uuidv4();
      const response = await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId: nonExistentLobbyId, playerId, playerName: 'Alice' })
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('not found');
    });

    it('should return 409 for lobby already in game', async () => {
      // Create lobby and add players
      const createResponse = await request(app)
        .post('/api/lobby/create')
        .expect(201);

      const lobbyId = createResponse.body.lobbyId;
      const playerId1 = uuidv4();
      const playerId2 = uuidv4();
      const playerId3 = uuidv4();

      await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: playerId1, playerName: 'Alice' })
        .expect(200);

      await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: playerId2, playerName: 'Bob' })
        .expect(200);

      // Transition to game
      await lobbyService.transitionToGame(lobbyId);

      // Try to join
      const response = await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: playerId3, playerName: 'Charlie' })
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('already in game');
    });
  });

  describe('GET /api/lobby/:id/status', () => {
    it('should return exists: false for non-existent lobby', async () => {
      const nonExistentId = uuidv4();

      const response = await request(app)
        .get(`/api/lobby/${nonExistentId}/status`)
        .expect(200)
        .expect('Content-Type', /json/);

      const body = response.body as LobbyStatusResponse;
      expect(body.exists).toBe(false);
      expect(body.gameStarted).toBe(false);
      expect(body.playerCount).toBe(0);
    });

    it('should return correct status for waiting lobby', async () => {
      // Create lobby
      const createResponse = await request(app)
        .post('/api/lobby/create')
        .expect(201);

      const lobbyId = createResponse.body.lobbyId;
      const playerId1 = uuidv4();
      const playerId2 = uuidv4();

      // Add two players
      await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: playerId1, playerName: 'Alice' })
        .expect(200);

      await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: playerId2, playerName: 'Bob' })
        .expect(200);

      // Check status
      const response = await request(app)
        .get(`/api/lobby/${lobbyId}/status`)
        .expect(200);

      const body = response.body as LobbyStatusResponse;
      expect(body.exists).toBe(true);
      expect(body.gameStarted).toBe(false);
      expect(body.playerCount).toBe(2);
    });

    it('should return gameStarted: true for lobby in game', async () => {
      // Create lobby
      const createResponse = await request(app)
        .post('/api/lobby/create')
        .expect(201);

      const lobbyId = createResponse.body.lobbyId;
      const playerId1 = uuidv4();
      const playerId2 = uuidv4();

      // Add players
      await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: playerId1, playerName: 'Alice' })
        .expect(200);

      await request(app)
        .post('/api/lobby/join')
        .send({ lobbyId, playerId: playerId2, playerName: 'Bob' })
        .expect(200);

      // Transition to game
      await lobbyService.transitionToGame(lobbyId);

      // Check status
      const response = await request(app)
        .get(`/api/lobby/${lobbyId}/status`)
        .expect(200);

      const body = response.body as LobbyStatusResponse;
      expect(body.exists).toBe(true);
      expect(body.gameStarted).toBe(true);
      expect(body.playerCount).toBe(2);
    });

    it('should return playerCount: 0 for empty lobby', async () => {
      // Create lobby (no players yet)
      const createResponse = await request(app)
        .post('/api/lobby/create')
        .expect(201);

      const lobbyId = createResponse.body.lobbyId;

      // Check status
      const response = await request(app)
        .get(`/api/lobby/${lobbyId}/status`)
        .expect(200);

      const body = response.body as LobbyStatusResponse;
      expect(body.exists).toBe(true);
      expect(body.gameStarted).toBe(false);
      expect(body.playerCount).toBe(0);
    });
  });
});
