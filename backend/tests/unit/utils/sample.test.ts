/**
 * Sample test to verify testing setup
 */

import { describe, it, expect } from 'vitest';

describe('Sample Test Suite', () => {
  it('should pass a basic assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('should verify TypeScript is working', () => {
    const result: number = 42;
    expect(result).toBe(42);
  });

  it('should support async tests', async () => {
    const promise = Promise.resolve('success');
    await expect(promise).resolves.toBe('success');
  });
});
