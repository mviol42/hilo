import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 10000, // Integration tests may take longer
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@hilo/shared': path.resolve(__dirname, '../shared/types'),
    },
  },
});
