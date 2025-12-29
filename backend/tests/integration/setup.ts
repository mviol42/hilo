/**
 * Integration test setup utilities
 */

import { Express } from 'express';
import { Server } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from '../../src/server';
import { createMockRedisService } from '../testUtils/redisSetup';

export const TEST_PORT = 3001;

export interface TestServer {
  app: Express;
  server: Server;
  io: SocketIOServer;
  port: number;
}

export async function createTestServer(port?: number): Promise<TestServer> {
  // Set up redis-mock before creating server
  const mockRedisService = await createMockRedisService();
  const redisServiceModule = await import('../../src/services/redisService');
  Object.assign(redisServiceModule.redisService, mockRedisService);

  // Use the actual server setup from src/server.ts
  const { app, server, io } = await createServer();

  // Use provided port or calculate based on worker ID to avoid conflicts
  const testPort = port || TEST_PORT + (parseInt(process.env.VITEST_POOL_ID || '0', 10));

  // Start listening on test port
  await new Promise<void>((resolve) => {
    server.listen(testPort, () => {
      resolve();
    });
  });

  return { app, server, io, port: testPort };
}

export async function closeTestServer(testServer: TestServer | undefined): Promise<void> {
  if (!testServer) {
    return; // Nothing to close if server wasn't created
  }

  try {
    // Import services for cleanup
    const { lobbyService } = await import('../../src/services/lobbyService');
    const { redisService } = await import('../../src/services/redisService');

    // Stop lobby cleanup interval
    lobbyService.stopCleanup();

    // Disconnect all sockets
    const sockets = await testServer.io.fetchSockets();
    for (const socket of sockets) {
      socket.disconnect(true);
    }

    // Close Socket.IO server
    await new Promise<void>((resolve, reject) => {
      testServer.io.close((err) => {
        if (err && err.message !== 'Server is not running.') {
          return reject(err);
        }
        resolve();
      });
    });

    // Close HTTP server
    await new Promise<void>((resolve, reject) => {
      if (testServer.server.listening) {
        // Close existing connections
        testServer.server.closeAllConnections?.();

        testServer.server.close((err) => {
          if (err) return reject(err);
          resolve();
        });
      } else {
        resolve();
      }
    });

    // Disconnect Redis
    await redisService.disconnect();
  } catch (error) {
    console.error('Error during test server cleanup:', error);
    throw error;
  }
}
