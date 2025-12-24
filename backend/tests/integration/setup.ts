/**
 * Integration test setup utilities
 */

import { Express } from 'express';
import { Server } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from '../../src/server';

export const TEST_PORT = 3001;

export interface TestServer {
  app: Express;
  server: Server;
  io: SocketIOServer;
}

export async function createTestServer(): Promise<TestServer> {
  // Use the actual server setup from src/server.ts
  const { app, server, io } = await createServer();

  // Start listening on test port
  await new Promise<void>((resolve) => {
    server.listen(TEST_PORT, () => {
      resolve();
    });
  });

  return { app, server, io };
}

export async function closeTestServer(testServer: TestServer): Promise<void> {
  return new Promise((resolve, reject) => {
    // Close Socket.IO first
    testServer.io.close((err) => {
      if (err && err.message !== 'Server is not running.') {
        return reject(err);
      }

      // Then close the HTTP server
      if (testServer.server.listening) {
        testServer.server.close((err) => {
          if (err) return reject(err);
          resolve();
        });
      } else {
        resolve();
      }
    });
  });
}
