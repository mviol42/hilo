/**
 * Unit tests for Lobby routes
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import express from 'express';
import { lobbyRouter } from '../../../src/routes/lobby';
import { lobbyService } from '../../../src/services/lobbyService';
import { v4 as uuidv4 } from 'uuid';

describe('Lobby Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/lobby', lobbyRouter);
    lobbyService.clearAll();
  });

  afterEach(() => {
    lobbyService.clearAll();
  });

  describe('POST /api/lobby/join', () => {
    it('should reject non-UUID playerId', async () => {
      const lobby = lobbyService.createLobby();

      const response = await request(app)
        .post('/api/lobby/join')
        .send({
          lobbyId: lobby.id,
          playerId: 'Patrick', // Invalid - not a UUID
          playerName: 'Patrick',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad request');
      expect(response.body.message).toBe('playerId must be a valid UUID');
    });

    it('should reject empty string as playerId', async () => {
      const lobby = lobbyService.createLobby();

      const response = await request(app)
        .post('/api/lobby/join')
        .send({
          lobbyId: lobby.id,
          playerId: '',
          playerName: 'Test',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('playerId');
    });

    it('should reject malformed UUID', async () => {
      const lobby = lobbyService.createLobby();

      const response = await request(app)
        .post('/api/lobby/join')
        .send({
          lobbyId: lobby.id,
          playerId: '12345-abcde-67890',
          playerName: 'Test',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('playerId must be a valid UUID');
    });

    it('should accept valid UUID playerId', async () => {
      const lobby = lobbyService.createLobby();
      const validPlayerId = uuidv4();

      const response = await request(app)
        .post('/api/lobby/join')
        .send({
          lobbyId: lobby.id,
          playerId: validPlayerId,
          playerName: 'ValidPlayer',
        });

      expect(response.status).toBe(200);
      expect(response.body.playerId).toBe(validPlayerId);
      expect(response.body.lobby.players).toHaveLength(1);
    });

    it('should reject duplicate playerId', async () => {
      const lobby = lobbyService.createLobby();
      const playerId = uuidv4();

      // First join should succeed
      await request(app)
        .post('/api/lobby/join')
        .send({
          lobbyId: lobby.id,
          playerId,
          playerName: 'Player1',
        });

      // Second join with same playerId should fail
      const response = await request(app)
        .post('/api/lobby/join')
        .send({
          lobbyId: lobby.id,
          playerId,
          playerName: 'Player2',
        });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe('Player ID already exists in this lobby');
    });
  });
});
