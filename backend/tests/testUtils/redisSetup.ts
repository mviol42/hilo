/**
 * Redis mock setup utilities for tests
 */

import { createClient } from 'redis-mock';
import { RedisService } from '../../src/services/redisService';

/**
 * Promisify redis-mock client methods
 */
function promisifyRedisMock(client: any): any {
  const promisified = client;

  // Wrap callback-based methods to return promises
  const originalSet = client.set.bind(client);
  const originalGet = client.get.bind(client);
  const originalSetEx = client.setex ? client.setex.bind(client) : null;
  const originalDel = client.del.bind(client);
  const originalRPush = client.rpush.bind(client);
  const originalLRange = client.lrange.bind(client);
  const originalExpire = client.expire.bind(client);

  promisified.set = (key: string, value: string) => {
    return new Promise((resolve, reject) => {
      originalSet(key, value, (err: any, result: any) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  };

  promisified.get = (key: string) => {
    return new Promise((resolve, reject) => {
      originalGet(key, (err: any, result: any) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  };

  promisified.setEx = (key: string, ttl: number, value: string) => {
    return new Promise((resolve, reject) => {
      if (originalSetEx) {
        originalSetEx(key, ttl, value, (err: any, result: any) => {
          if (err) reject(err);
          else resolve(result);
        });
      } else {
        // Fallback: just use set (ttl not supported in basic redis-mock)
        originalSet(key, value, (err: any, result: any) => {
          if (err) reject(err);
          else resolve(result);
        });
      }
    });
  };

  promisified.del = (keys: string | string[]) => {
    return new Promise((resolve, reject) => {
      const keysArray = Array.isArray(keys) ? keys : [keys];
      originalDel(...keysArray, (err: any, result: any) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  };

  promisified.rPush = (key: string, value: string) => {
    return new Promise((resolve, reject) => {
      originalRPush(key, value, (err: any, result: any) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  };

  promisified.lRange = (key: string, start: number, stop: number) => {
    return new Promise((resolve, reject) => {
      originalLRange(key, start, stop, (err: any, result: any) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  };

  promisified.expire = (key: string, ttl: number) => {
    return new Promise((resolve, reject) => {
      originalExpire(key, ttl, (err: any, result: any) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  };

  return promisified;
}

/**
 * Create a new RedisService with redis-mock for testing
 * @returns A RedisService instance using redis-mock
 */
export async function createMockRedisService(): Promise<RedisService> {
  const mockClient = createClient() as any;

  // Increase max listeners to avoid warnings
  if (typeof mockClient.setMaxListeners === 'function') {
    mockClient.setMaxListeners(50);
  }

  // Promisify the client
  const promisifiedClient = promisifyRedisMock(mockClient);

  const redisService = new RedisService(promisifiedClient);
  return redisService;
}

/**
 * Reset a redis-mock client by flushing all data
 * @param redisService - The RedisService instance to reset
 */
export async function resetMockRedis(redisService: RedisService): Promise<void> {
  if (!redisService.isAvailable()) {
    return;
  }

  try {
    const client = redisService.getClient() as any;
    // redis-mock supports flushdb to clear all data
    if (typeof client.flushdb === 'function') {
      await new Promise<void>((resolve, reject) => {
        client.flushdb((err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } else if (typeof client.flushAll === 'function') {
      await client.flushAll();
    }
  } catch (error) {
    console.error('[Test] Failed to reset redis-mock:', error);
  }
}

/**
 * Setup redis-mock for the global redisService singleton
 * This must be called before any service imports
 */
export async function setupGlobalMockRedis(): Promise<void> {
  const mockRedisService = await createMockRedisService();
  const { redisService } = await import('../../src/services/redisService');

  // Replace all properties and methods
  Object.assign(redisService, mockRedisService);
}
