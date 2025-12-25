#!/usr/bin/env node

import { GameClient } from './client';
import { logger } from './logger';

const serverURL = process.env.SERVER_URL || 'http://localhost:3000';

const client = new GameClient(serverURL);

process.on('SIGINT', () => {
  logger.info('Shutting down...');
  client.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down...');
  client.stop();
  process.exit(0);
});

client.start().catch((error) => {
  logger.error(`Fatal error: ${error.message || error}`);
  process.exit(1);
});
