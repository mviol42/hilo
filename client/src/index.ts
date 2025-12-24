#!/usr/bin/env node

import { GameClient } from './client';

const serverURL = process.env.SERVER_URL || 'http://localhost:3000';

const client = new GameClient(serverURL);

process.on('SIGINT', () => {
  console.log('\n\nShutting down...');
  client.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\nShutting down...');
  client.stop();
  process.exit(0);
});

client.start().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
