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
  const { gameRouter, setSocketIO } = await import('./routes/game');
  const { lobbyService } = await import('./services/lobbyService');

  // Pass Socket.IO instance to game router
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
    console.log(`Client connected: ${socket.id}`);

    // Register all event handlers
    registerLobbyHandlers(io, socket);
    registerGameHandlers(io, socket);

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  return { app, server, io };
}
