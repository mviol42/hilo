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

  io.on('connection', (socket) => {
    const playerId = socket.handshake.query.playerId as string | undefined;
    const lobbyId = socket.handshake.query.lobbyId as string | undefined;

    logger.info(`Client connected: ${socket.id}`, { playerId, lobbyId });

    // Update player's socketId if they provided playerId and lobbyId
    if (playerId && lobbyId) {
      try {
        lobbyService.updateSocketId(lobbyId, playerId, socket.id);
        logger.info(`Updated socketId for player ${playerId} in lobby ${lobbyId}`);
      } catch (error) {
        logger.error('Failed to update socketId:', error);
      }
    }

    socket.on('disconnect', async () => {
      logger.info(`Client disconnected: ${socket.id}`, { playerId, lobbyId });

      // Handle disconnection - remove player from lobby if applicable
      if (playerId && lobbyId) {
        try {
          const lobbyBefore = lobbyService.getLobby(lobbyId);
          if (!lobbyBefore) {
            return;
          }

          const wasLeader = lobbyBefore.leaderId === playerId;
          const oldLeaderId = lobbyBefore.leaderId;

          // Leave the lobby
          lobbyService.leaveLobby(lobbyId, playerId);

          // Clear session from Redis
          redisService.clearPlayerSession(playerId).catch((err) => {
            logger.error('Failed to clear session on disconnect:', err);
          });

          // Get updated lobby state and notify remaining players
          const lobbyAfter = lobbyService.getLobbyState(lobbyId);
          if (lobbyAfter) {
            const { notificationService } = await import('./services/notificationService');
            notificationService.notifyPlayerLeft(lobbyId, playerId, lobbyAfter);

            // If leader changed, notify players
            if (wasLeader && lobbyAfter.leaderId !== oldLeaderId) {
              notificationService.notifyLeaderChanged(lobbyId, lobbyAfter.leaderId, lobbyAfter);
            }
          }
        } catch (error) {
          logger.error('Error handling disconnect:', error);
        }
      }
    });
  });

  return { app, server, io };
}
