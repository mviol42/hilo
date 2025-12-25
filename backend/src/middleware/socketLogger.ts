/**
 * Socket.IO middleware for socket message logging
 */

import { Socket } from 'socket.io';
import { logger } from '../config/logger';

/**
 * Middleware to log incoming and outgoing socket events
 */
export function createSocketLogger() {
  return (socket: Socket, next: (err?: Error) => void) => {
    // Log connection
    logger.info(
      `Socket Connection: ${JSON.stringify({
        socketId: socket.id,
        timestamp: new Date().toISOString(),
      })}`
    );

    // Log all incoming events
    socket.onAny((eventName, ...args) => {
      logger.info(
        `Socket Message Received: ${JSON.stringify({
          eventName,
          payload: args,
          socketId: socket.id,
          timestamp: new Date().toISOString(),
        })}`
      );
    });

    // Log all outgoing events
    socket.onAnyOutgoing((eventName, ...args) => {
      logger.info(
        `Socket Message Sent: ${JSON.stringify({
          eventName,
          payload: args,
          socketId: socket.id,
          timestamp: new Date().toISOString(),
        })}`
      );
    });

    // Log disconnection
    socket.on('disconnect', (reason) => {
      logger.info(
        `Socket Disconnection: ${JSON.stringify({
          socketId: socket.id,
          reason,
          timestamp: new Date().toISOString(),
        })}`
      );
    });

    next();
  };
}
