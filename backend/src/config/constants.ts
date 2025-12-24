/**
 * Configuration constants
 */

export const PORT = process.env.PORT || 3000;

export const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
export const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

export const NODE_ENV = process.env.NODE_ENV || 'development';

// Lobby configuration
export const LOBBY_CLEANUP_INTERVAL = parseInt(
  process.env.LOBBY_CLEANUP_INTERVAL || '60000',
  10
); // 1 minute
export const LOBBY_TIMEOUT = parseInt(
  process.env.LOBBY_TIMEOUT || '3600000',
  10
); // 1 hour
