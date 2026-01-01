/**
 * Redis service for game state persistence, action logging, and session storage
 */

import { createClient, RedisClientType } from 'redis';
import {
  REDIS_HOST,
  REDIS_PORT,
  REDIS_ENABLED,
  REDIS_TTL_ACTIVE_GAME,
  REDIS_TTL_COMPLETED_GAME,
  REDIS_TTL_LOBBY,
  REDIS_TTL_SESSION,
} from '../config/constants';
import { GameState, GameLogEntry, GamePhase } from '@hilo/shared';
import { Lobby, LobbyId } from '@hilo/shared';
import { PlayerId } from '@hilo/shared';

/**
 * Session data for player reconnection
 */
export interface PlayerSession {
  playerId: PlayerId;
  lobbyId?: LobbyId;
  gameId?: string;
  socketId?: string;
  lastActive: Date;
}

/**
 * Serializable version of GameState (Maps converted to objects)
 */
interface SerializableGameState {
  id: string;
  phase: GamePhase;
  players: Record<string, unknown>;
  deck: unknown[];
  pile: unknown[];
  discardPile: unknown[];
  activePlayerId: string;
  turnOrder: string[];
  log: Array<{
    timestamp: string;
    playerId: string;
    action: string;
    cards?: unknown[];
    description: string;
  }>;
  winner?: string;
  lastAction?: {
    type: string;
    playerId: string;
    playerName: string;
    cards?: unknown[];
    blowUpReason?: string;
    pickedUpCount?: number;
    timestamp: string;
  };
  stateVersion: number;
}

/**
 * RedisService - Handles all Redis operations with graceful fallback
 */
export class RedisService {
  private client: RedisClientType | null = null;
  private isConnected = false;
  private isEnabled: boolean;

  /**
   * Create a new RedisService instance
   * @param clientOverride - Optional Redis client for dependency injection (testing)
   */
  constructor(clientOverride?: RedisClientType) {
    this.isEnabled = REDIS_ENABLED;
    if (clientOverride) {
      this.client = clientOverride;
      this.isConnected = true;
      this.isEnabled = true;
    }
  }

  /**
   * Initialize Redis connection
   */
  async connect(): Promise<void> {
    // If already connected (e.g., mock client injected via constructor), skip
    if (this.isConnected && this.client) {
      return;
    }

    if (!this.isEnabled) {
      console.log('[Redis] Disabled (running in test mode or REDIS_ENABLED=false)');
      return;
    }

    try {
      this.client = createClient({
        socket: {
          host: REDIS_HOST,
          port: REDIS_PORT,
        },
      }) as RedisClientType;

      this.client.on('error', (err) => {
        console.error('[Redis] Connection error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('[Redis] Connected successfully');
        this.isConnected = true;
      });

      this.client.on('reconnecting', () => {
        console.log('[Redis] Reconnecting...');
      });

      // Check if connect method exists (real Redis client has it, redis-mock doesn't)
      if (typeof this.client.connect === 'function') {
        await this.client.connect();
      } else {
        // For redis-mock, mark as connected immediately
        this.isConnected = true;
        console.log('[Redis] Connected successfully');
      }
    } catch (error) {
      console.error('[Redis] Failed to connect:', error);
      this.client = null;
      this.isConnected = false;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      // Check if quit method exists (real Redis client has it, redis-mock might not)
      if (typeof this.client.quit === 'function') {
        await this.client.quit();
      }
      this.isConnected = false;
      console.log('[Redis] Disconnected');
    }
  }

  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return this.isEnabled && this.isConnected && this.client !== null;
  }

  /**
   * Get the Redis client instance
   * @throws Error if client is not available
   */
  getClient(): RedisClientType {
    if (!this.client) {
      throw new Error('[Redis] Client not available');
    }
    return this.client;
  }

  /**
   * Save game state to Redis
   */
  async saveGameState(gameState: GameState): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const key = `hilo:game:${gameState.id}:state`;
      const serialized = this.serializeGameState(gameState);

      // Determine TTL based on game phase
      const ttl = gameState.phase === 'ended'
        ? REDIS_TTL_COMPLETED_GAME
        : REDIS_TTL_ACTIVE_GAME;

      if (ttl > 0) {
        await this.client!.setEx(key, ttl, JSON.stringify(serialized));
      } else {
        await this.client!.set(key, JSON.stringify(serialized));
      }
    } catch (error) {
      console.error('[Redis] Failed to save game state:', error);
    }
  }

  /**
   * Retrieve game state from Redis
   */
  async getGameState(gameId: string): Promise<GameState | null> {
    if (!this.isAvailable()) return null;

    try {
      const key = `hilo:game:${gameId}:state`;
      const data = await this.client!.get(key);

      if (!data) return null;

      const parsed = JSON.parse(data) as SerializableGameState;
      return this.deserializeGameState(parsed);
    } catch (error) {
      console.error('[Redis] Failed to retrieve game state:', error);
      return null;
    }
  }

  /**
   * Log game action to Redis
   */
  async logGameAction(gameId: string, logEntry: GameLogEntry): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const key = `hilo:game:${gameId}:log`;
      const serialized = {
        ...logEntry,
        timestamp: logEntry.timestamp.toISOString(),
      };

      await this.client!.rPush(key, JSON.stringify(serialized));

      // Set expiry on the log (same as completed game)
      await this.client!.expire(key, REDIS_TTL_COMPLETED_GAME);
    } catch (error) {
      console.error('[Redis] Failed to log game action:', error);
    }
  }

  /**
   * Get complete game log from Redis
   */
  async getGameLog(gameId: string): Promise<GameLogEntry[]> {
    if (!this.isAvailable()) return [];

    try {
      const key = `hilo:game:${gameId}:log`;
      const entries = await this.client!.lRange(key, 0, -1);

      return entries.map((entry) => {
        const parsed = JSON.parse(entry);
        return {
          ...parsed,
          timestamp: new Date(parsed.timestamp),
        };
      });
    } catch (error) {
      console.error('[Redis] Failed to retrieve game log:', error);
      return [];
    }
  }

  /**
   * Delete game state and log from Redis
   */
  async deleteGame(gameId: string): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const stateKey = `hilo:game:${gameId}:state`;
      const logKey = `hilo:game:${gameId}:log`;
      await this.client!.del([stateKey, logKey]);
    } catch (error) {
      console.error('[Redis] Failed to delete game:', error);
    }
  }

  /**
   * Save lobby state to Redis
   */
  async saveLobby(lobby: Lobby): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const key = `hilo:lobby:${lobby.id}:state`;
      const serialized = {
        id: lobby.id,
        players: Object.fromEntries(lobby.players),
        leaderId: lobby.leaderId,
        status: lobby.status,
        createdAt: lobby.createdAt.toISOString(),
        lastActivityAt: lobby.lastActivityAt.toISOString(),
      };

      await this.client!.setEx(key, REDIS_TTL_LOBBY, JSON.stringify(serialized));
    } catch (error) {
      console.error('[Redis] Failed to save lobby:', error);
    }
  }

  /**
   * Retrieve lobby from Redis
   */
  async getLobby(lobbyId: LobbyId): Promise<Lobby | null> {
    if (!this.isAvailable()) return null;

    try {
      const key = `hilo:lobby:${lobbyId}:state`;
      const data = await this.client!.get(key);

      if (!data) return null;

      const parsed = JSON.parse(data);
      return {
        id: parsed.id,
        players: new Map(Object.entries(parsed.players)),
        leaderId: parsed.leaderId,
        status: parsed.status,
        createdAt: new Date(parsed.createdAt),
        lastActivityAt: new Date(parsed.lastActivityAt),
      };
    } catch (error) {
      console.error('[Redis] Failed to retrieve lobby:', error);
      return null;
    }
  }

  /**
   * Delete lobby from Redis
   */
  async deleteLobby(lobbyId: LobbyId): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const key = `hilo:lobby:${lobbyId}:state`;
      await this.client!.del(key);
    } catch (error) {
      console.error('[Redis] Failed to delete lobby:', error);
    }
  }

  /**
   * Save player session to Redis
   */
  async setPlayerSession(session: PlayerSession): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const key = `hilo:player:${session.playerId}:session`;
      const serialized = {
        ...session,
        lastActive: session.lastActive.toISOString(),
      };

      await this.client!.setEx(key, REDIS_TTL_SESSION, JSON.stringify(serialized));
    } catch (error) {
      console.error('[Redis] Failed to save player session:', error);
    }
  }

  /**
   * Retrieve player session from Redis
   */
  async getPlayerSession(playerId: PlayerId): Promise<PlayerSession | null> {
    if (!this.isAvailable()) return null;

    try {
      const key = `hilo:player:${playerId}:session`;
      const data = await this.client!.get(key);

      if (!data) return null;

      const parsed = JSON.parse(data);
      return {
        ...parsed,
        lastActive: new Date(parsed.lastActive),
      };
    } catch (error) {
      console.error('[Redis] Failed to retrieve player session:', error);
      return null;
    }
  }

  /**
   * Clear player session from Redis
   */
  async clearPlayerSession(playerId: PlayerId): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const key = `hilo:player:${playerId}:session`;
      await this.client!.del(key);
    } catch (error) {
      console.error('[Redis] Failed to clear player session:', error);
    }
  }

  /**
   * Serialize GameState for Redis storage
   */
  private serializeGameState(gameState: GameState): SerializableGameState {
    return {
      id: gameState.id,
      phase: gameState.phase,
      players: Object.fromEntries(gameState.players),
      deck: gameState.deck,
      pile: gameState.pile,
      discardPile: gameState.discardPile,
      activePlayerId: gameState.activePlayerId,
      turnOrder: gameState.turnOrder,
      log: gameState.log.map((entry) => ({
        ...entry,
        timestamp: entry.timestamp.toISOString(),
      })),
      winner: gameState.winner,
      lastAction: gameState.lastAction,
      stateVersion: gameState.stateVersion,
    };
  }

  /**
   * Deserialize GameState from Redis storage
   */
  private deserializeGameState(data: SerializableGameState): GameState {
    return {
      id: data.id,
      phase: data.phase,
      players: new Map(Object.entries(data.players)),
      deck: data.deck,
      pile: data.pile,
      discardPile: data.discardPile,
      activePlayerId: data.activePlayerId,
      turnOrder: data.turnOrder,
      log: data.log.map((entry) => ({
        ...entry,
        timestamp: new Date(entry.timestamp),
      })),
      winner: data.winner,
      lastAction: data.lastAction,
      stateVersion: data.stateVersion,
    } as GameState;
  }
}

// Export singleton instance
export const redisService = new RedisService();
