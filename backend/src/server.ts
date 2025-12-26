/**
 * Express and Socket.IO server setup
 */

import express, { Express } from 'express';
import { createServer as createHttpServer, Server } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { httpLogger } from './middleware/httpLogger';
import { createSocketLogger } from './middleware/socketLogger';
import { logger } from './config/logger';
import { NODE_ENV } from './config/constants';

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

  // Health check - verify Redis connectivity
  app.get('/health', async (req, res) => {
    try {
      const { redisService } = await import('./services/redisService');
      const redisAvailable = redisService.isAvailable();

      if (!redisAvailable) {
        return res.status(503).json({
          status: 'unhealthy',
          redis: 'disconnected'
        });
      }

      // Test Redis connectivity with a ping
      const client = redisService.getClient();
      await client.ping();

      res.json({
        status: 'ok',
        redis: 'connected'
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        redis: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
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

  // Serve frontend static files in production
  if (NODE_ENV === 'production') {
    const frontendPath = path.join(__dirname, '../../frontend/dist');
    app.use(express.static(frontendPath));

    // Handle client-side routing - serve index.html for all non-API routes
    app.get('*', (req, res, next) => {
      // Skip API routes and socket.io
      if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
        return next();
      }
      res.sendFile(path.join(frontendPath, 'index.html'));
    });
  }

  // Start lobby cleanup
  await lobbyService.startCleanup();

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
