/**
 * Express and Socket.IO server setup
 */

import express, { Express } from 'express';
import { createServer as createHttpServer, Server } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { httpLogger } from './middleware/httpLogger';
import { createSocketLogger } from './middleware/socketLogger';
import { logger } from './config/logger';

export async function createServer() {
  const app: Express = express();
  const server: Server = createHttpServer(app);
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*', // TODO: Configure for production
      methods: ['GET', 'POST'],
    },
  });

  // Socket.IO middleware
  io.use(createSocketLogger());

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(httpLogger);

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // API routes
  const { lobbyRouter, setLobbySocketIO } = await import('./routes/lobby');
  const { gameRouter, setSocketIO } = await import('./routes/game');
  const { lobbyService } = await import('./services/lobbyService');
  const { redisService } = await import('./services/redisService');

  // Initialize Redis
  await redisService.connect();

  // Pass Socket.IO instance to routers
  setLobbySocketIO(io);
  setSocketIO(io);

  app.use('/api/lobby', lobbyRouter);
  app.use('/api/game', gameRouter);

  // Start lobby cleanup
  lobbyService.startCleanup();

  // Error handling
  const { notFoundHandler, errorHandler } = await import('./middleware/errorHandler');
  app.use(notFoundHandler);
  app.use(errorHandler);

  // Socket.IO event handlers
  const { registerLobbyHandlers, registerGameHandlers } = await import('./handlers');

  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    // Register all event handlers
    registerLobbyHandlers(io, socket);
    registerGameHandlers(io, socket);

    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });

  return { app, server, io };
}
