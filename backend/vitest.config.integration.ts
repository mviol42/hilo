import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 10000, // Integration tests may take longer
    hookTimeout: 30000, // Increased timeout for setup/teardown
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Run all tests in a single process to avoid port conflicts
      },
    },
  },
  resolve: {
    alias: {
      '@hilo/shared': path.resolve(__dirname, '../shared/types'),
    },
  },
});
