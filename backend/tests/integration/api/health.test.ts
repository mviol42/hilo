/**
 * Integration tests for health check endpoint
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { Server } from 'http';
import { createTestServer, closeTestServer, TestServer } from '../setup';

describe('Health Check API', () => {
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

  describe('GET /health', () => {
    it('should return 200 OK with status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('ok');
    });

    it('should return JSON content type', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/);

      expect(response.body).toBeDefined();
    });

    it('should respond quickly', async () => {
      const startTime = Date.now();

      await request(app)
        .get('/health')
        .expect(200);

      const duration = Date.now() - startTime;

      // Health check should be very fast (< 100ms)
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Server Status', () => {
    it('should have server listening', () => {
      expect(server.listening).toBe(true);
    });

    it('should have Socket.IO server attached', () => {
      expect(testServer.io).toBeDefined();
      expect(testServer.io.engine).toBeDefined();
    });
  });
});
