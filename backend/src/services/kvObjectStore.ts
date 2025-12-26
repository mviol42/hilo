/**
 * KVObjectStore - Type-safe Redis key-value object storage abstraction
 *
 * Provides a generic abstraction for storing and retrieving typed objects in Redis
 * with automatic serialization/deserialization of Maps and Dates.
 */

import { RedisClientType } from 'redis';

/**
 * Serializer interface for converting between typed objects and JSON-serializable objects
 */
export interface Serializer<T> {
  serialize(value: T): unknown;
  deserialize(data: unknown): T;
}

/**
 * Configuration for KVObjectStore
 */
export interface KVObjectStoreConfig<T> {
  /** Redis client instance */
  client: RedisClientType;
  /** Key prefix (e.g., 'hilo:game', 'hilo:lobby') */
  keyPrefix: string;
  /** Optional serializer for custom serialization logic */
  serializer?: Serializer<T>;
  /** Default TTL in seconds (0 = no expiry) */
  defaultTTL?: number;
}

/**
 * Generic key-value object store backed by Redis
 *
 * @template T - The type of objects stored in this KV store
 *
 * @example
 * ```typescript
 * const gameStore = new KVObjectStore<GameState>({
 *   client: redisClient,
 *   keyPrefix: 'hilo:game',
 *   defaultTTL: 0
 * });
 *
 * await gameStore.set('game-123', gameState);
 * const state = await gameStore.get('game-123');
 * ```
 */
export class KVObjectStore<T> {
  private client: RedisClientType;
  private keyPrefix: string;
  private serializer?: Serializer<T>;
  private defaultTTL: number;

  constructor(config: KVObjectStoreConfig<T>) {
    this.client = config.client;
    this.keyPrefix = config.keyPrefix;
    this.serializer = config.serializer;
    this.defaultTTL = config.defaultTTL ?? 0;
  }

  /**
   * Generate full Redis key with prefix
   */
  private getKey(id: string, suffix?: string): string {
    const base = `${this.keyPrefix}:${id}`;
    return suffix ? `${base}:${suffix}` : base;
  }

  /**
   * Get an object from the store
   *
   * @param id - Object identifier
   * @param suffix - Optional key suffix (e.g., 'state', 'log')
   * @returns The stored object or null if not found
   */
  async get(id: string, suffix?: string): Promise<T | null> {
    try {
      const key = this.getKey(id, suffix);
      const data = await this.client.get(key);

      if (!data) {
        return null;
      }

      const parsed = JSON.parse(data);

      // Use custom serializer if provided, otherwise return parsed data
      return this.serializer
        ? this.serializer.deserialize(parsed)
        : parsed as T;
    } catch (error) {
      console.error(`[KVObjectStore] Failed to get ${this.keyPrefix}:${id}:`, error);
      return null;
    }
  }

  /**
   * Set an object in the store
   *
   * @param id - Object identifier
   * @param value - Object to store
   * @param suffix - Optional key suffix (e.g., 'state', 'log')
   * @param ttl - Optional TTL in seconds (overrides default)
   */
  async set(id: string, value: T, suffix?: string, ttl?: number): Promise<void> {
    try {
      const key = this.getKey(id, suffix);

      // Use custom serializer if provided
      const serialized = this.serializer
        ? this.serializer.serialize(value)
        : value;

      const json = JSON.stringify(serialized);
      const effectiveTTL = ttl ?? this.defaultTTL;

      if (effectiveTTL > 0) {
        await this.client.setEx(key, effectiveTTL, json);
      } else {
        await this.client.set(key, json);
      }
    } catch (error) {
      console.error(`[KVObjectStore] Failed to set ${this.keyPrefix}:${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete an object from the store
   *
   * @param id - Object identifier
   * @param suffix - Optional key suffix
   */
  async delete(id: string, suffix?: string): Promise<void> {
    try {
      const key = this.getKey(id, suffix);
      await this.client.del(key);
    } catch (error) {
      console.error(`[KVObjectStore] Failed to delete ${this.keyPrefix}:${id}:`, error);
      throw error;
    }
  }

  /**
   * Check if an object exists in the store
   *
   * @param id - Object identifier
   * @param suffix - Optional key suffix
   * @returns true if the key exists
   */
  async exists(id: string, suffix?: string): Promise<boolean> {
    try {
      const key = this.getKey(id, suffix);
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`[KVObjectStore] Failed to check existence ${this.keyPrefix}:${id}:`, error);
      return false;
    }
  }

  /**
   * Get all keys matching the prefix pattern
   *
   * @param pattern - Optional pattern to match (e.g., '*:state')
   * @returns Array of matching key IDs (without prefix)
   */
  async keys(pattern?: string): Promise<string[]> {
    try {
      const searchPattern = pattern
        ? `${this.keyPrefix}:${pattern}`
        : `${this.keyPrefix}:*`;

      const keys = await this.client.keys(searchPattern);

      // Strip prefix from keys to return just IDs
      const prefixLength = this.keyPrefix.length + 1; // +1 for ':'
      return keys.map(key => key.substring(prefixLength));
    } catch (error) {
      console.error(`[KVObjectStore] Failed to get keys for ${this.keyPrefix}:`, error);
      return [];
    }
  }
}

/**
 * Helper function to create a serializer for objects with Maps and Dates
 */
export function createMapDateSerializer<T>(): Serializer<T> {
  return {
    serialize(value: T): unknown {
      return JSON.parse(JSON.stringify(value, (key, val) => {
        // Convert Maps to plain objects
        if (val instanceof Map) {
          return Object.fromEntries(val);
        }
        // Convert Dates to ISO strings
        if (val instanceof Date) {
          return val.toISOString();
        }
        return val;
      }));
    },

    deserialize(data: unknown): T {
      // This is a basic deserializer - specific types may need custom logic
      return data as T;
    }
  };
}
