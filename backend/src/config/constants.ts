/**
 * Configuration constants
 */

export const PORT = process.env.PORT || 3000;

export const NODE_ENV = process.env.NODE_ENV || 'development';

export const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
export const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
export const REDIS_ENABLED =
  process.env.REDIS_ENABLED !== 'false' && NODE_ENV !== 'test';

// Lobby configuration
export const LOBBY_CLEANUP_INTERVAL = parseInt(
  process.env.LOBBY_CLEANUP_INTERVAL || '60000',
  10
); // 1 minute
export const LOBBY_TIMEOUT = parseInt(
  process.env.LOBBY_TIMEOUT || '3600000',
  10
); // 1 hour

// Redis TTL configuration (in seconds)
export const REDIS_TTL_ACTIVE_GAME = 0; // No expiry for active games
export const REDIS_TTL_COMPLETED_GAME = 86400; // 24 hours
export const REDIS_TTL_LOBBY = 7200; // 2 hours
export const REDIS_TTL_SESSION = 86400; // 24 hours
