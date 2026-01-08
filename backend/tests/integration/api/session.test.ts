/**
 * Integration tests for session endpoints
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { Server } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { createTestServer, closeTestServer, TestServer } from '../setup';
import { lobbyService } from '../../../src/services/lobbyService';
import { gameService } from '../../../src/services/gameService';
import { RejoinResponse } from '@hilo/shared';

describe('Session API', () => {
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
    await gameService.clearAll();
  });

  describe('POST /api/session/rejoin', () => {
    describe('validation', () => {
      it('should return 400 if playerId is missing', async () => {
        const response = await request(app)
          .post('/api/session/rejoin')
          .send({ lobbyId: uuidv4() })
          .expect(400);

        expect(response.body.error).toBe('Bad request');
        expect(response.body.message).toContain('playerId');
      });

      it('should return 400 if playerId is not a valid UUID', async () => {
        const response = await request(app)
          .post('/api/session/rejoin')
          .send({ playerId: 'invalid-uuid', lobbyId: uuidv4() })
          .expect(400);

        expect(response.body.error).toBe('Bad request');
        expect(response.body.message).toContain('valid UUID');
      });

      it('should return 400 if neither lobbyId nor gameId is provided', async () => {
        const response = await request(app)
          .post('/api/session/rejoin')
          .send({ playerId: uuidv4() })
          .expect(400);

        expect(response.body.error).toBe('Bad request');
        expect(response.body.message).toContain('lobbyId or gameId');
      });
    });

    describe('rejoin with lobbyId', () => {
      it('should successfully rejoin a lobby the player is in', async () => {
        // Create lobby and add player
        const createResponse = await request(app)
          .post('/api/lobby/create')
          .expect(201);

        const lobbyId = createResponse.body.lobbyId;
        const playerId = uuidv4();

        await request(app)
          .post('/api/lobby/join')
          .send({ lobbyId, playerId, playerName: 'Alice' })
          .expect(200);

        // Rejoin the lobby
        const response = await request(app)
          .post('/api/session/rejoin')
          .send({ playerId, lobbyId })
          .expect(200);

        const body = response.body as RejoinResponse;
        expect(body.success).toBe(true);
        expect(body.lobbyId).toBe(lobbyId);
        expect(body.lobby).toBeDefined();
        expect(body.lobby.id).toBe(lobbyId);
        expect(body.lobby.players).toHaveLength(1);
        expect(body.lobby.players[0].id).toBe(playerId);
        expect(body.gameId).toBeUndefined();
        expect(body.gameState).toBeUndefined();
      });

      it('should return 404 for non-existent lobby', async () => {
        const response = await request(app)
          .post('/api/session/rejoin')
          .send({ playerId: uuidv4(), lobbyId: uuidv4() })
          .expect(404);

        expect(response.body.error).toBe('Not found');
        expect(response.body.message).toContain('Lobby not found');
      });

      it('should return 403 with NOT_IN_LOBBY code if player is not in lobby', async () => {
        // Create lobby
        const createResponse = await request(app)
          .post('/api/lobby/create')
          .expect(201);

        const lobbyId = createResponse.body.lobbyId;
        const playerId1 = uuidv4();
        const playerId2 = uuidv4(); // Player not in lobby

        // Add player1 to lobby
        await request(app)
          .post('/api/lobby/join')
          .send({ lobbyId, playerId: playerId1, playerName: 'Alice' })
          .expect(200);

        // Try to rejoin with player2
        const response = await request(app)
          .post('/api/session/rejoin')
          .send({ playerId: playerId2, lobbyId })
          .expect(403);

        expect(response.body.error).toBe('Forbidden');
        expect(response.body.message).toContain('Player not in lobby');
        expect(response.body.code).toBe('NOT_IN_LOBBY');
      });

      it('should include gameId and gameState if lobby has active game', async () => {
        // Create lobby with 2 players
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

        // Ready player 2 and start game
        await request(app)
          .post('/api/lobby/ready')
          .send({ lobbyId, playerId: playerId2 })
          .expect(200);

        const startResponse = await request(app)
          .post('/api/game/start')
          .send({ lobbyId, playerId: playerId1 })
          .expect(200);

        const gameId = startResponse.body.gameState.id;

        // Rejoin with lobbyId
        const response = await request(app)
          .post('/api/session/rejoin')
          .send({ playerId: playerId1, lobbyId })
          .expect(200);

        const body = response.body as RejoinResponse;
        expect(body.success).toBe(true);
        expect(body.lobbyId).toBe(lobbyId);
        expect(body.gameId).toBe(gameId);
        expect(body.gameState).toBeDefined();
        expect(body.gameState?.id).toBe(gameId);
        expect(body.gameState?.myHand).toBeDefined();
      });
    });

    describe('rejoin with gameId', () => {
      it('should successfully rejoin a game the player is in', async () => {
        // Create lobby with 2 players and start game
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

        // Rejoin with gameId
        const response = await request(app)
          .post('/api/session/rejoin')
          .send({ playerId: playerId1, gameId })
          .expect(200);

        const body = response.body as RejoinResponse;
        expect(body.success).toBe(true);
        expect(body.lobbyId).toBe(lobbyId);
        expect(body.gameId).toBe(gameId);
        expect(body.gameState).toBeDefined();
        expect(body.gameState?.id).toBe(gameId);
        expect(body.lobby).toBeDefined();
        expect(body.lobby.status).toBe('in_game');
      });

      it('should return 404 for non-existent game', async () => {
        const response = await request(app)
          .post('/api/session/rejoin')
          .send({ playerId: uuidv4(), gameId: 'non-existent-game-id' })
          .expect(404);

        expect(response.body.error).toBe('Not found');
        expect(response.body.message).toContain('Game not found');
      });

      it('should return 403 if player is not in the game', async () => {
        // Create lobby with 2 players and start game
        const createResponse = await request(app)
          .post('/api/lobby/create')
          .expect(201);

        const lobbyId = createResponse.body.lobbyId;
        const playerId1 = uuidv4();
        const playerId2 = uuidv4();
        const playerId3 = uuidv4(); // Not in game

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

        // Try to rejoin with player3 who is not in the game
        const response = await request(app)
          .post('/api/session/rejoin')
          .send({ playerId: playerId3, gameId })
          .expect(403);

        expect(response.body.error).toBe('Forbidden');
        expect(response.body.code).toBe('NOT_IN_LOBBY');
      });

      it('should return personalized game state for the specific player', async () => {
        // Create lobby with 2 players and start game
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

        // Rejoin as player1
        const response1 = await request(app)
          .post('/api/session/rejoin')
          .send({ playerId: playerId1, gameId })
          .expect(200);

        // Rejoin as player2
        const response2 = await request(app)
          .post('/api/session/rejoin')
          .send({ playerId: playerId2, gameId })
          .expect(200);

        // Each player should get their own personalized view
        const body1 = response1.body as RejoinResponse;
        const body2 = response2.body as RejoinResponse;

        expect(body1.gameState?.myHand).toBeDefined();
        expect(body2.gameState?.myHand).toBeDefined();

        // They should have different hands
        expect(body1.gameState?.myHand).not.toEqual(body2.gameState?.myHand);

        // Each should see the other in otherPlayers
        expect(body1.gameState?.otherPlayers).toHaveProperty(playerId2);
        expect(body2.gameState?.otherPlayers).toHaveProperty(playerId1);
      });
    });
  });
});
