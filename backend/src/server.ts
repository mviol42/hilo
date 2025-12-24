/**
 * Express and Socket.IO server setup
 */

import express, { Express } from 'express';
import { createServer as createHttpServer, Server } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';

export async function createServer() {
  const app: Express = express();
  const server: Server = createHttpServer(app);
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*', // TODO: Configure for production
      methods: ['GET', 'POST'],
    },
  });

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // API routes
  const { lobbyRouter } = await import('./routes/lobby');
  const { gameRouter } = await import('./routes/game');

  app.use('/api/lobby', lobbyRouter);
  app.use('/api/game', gameRouter);

  // Error handling
  const { notFoundHandler, errorHandler } = await import('./middleware/errorHandler');
  app.use(notFoundHandler);
  app.use(errorHandler);

  // TODO: Add Socket.IO handlers

  return { app, server, io };
}
