/**
 * Entry point for Hi-Lo backend server
 */

import { createServer } from './server';
import { PORT } from './config/constants';

async function start() {
  const { app, server } = await createServer();

  server.listen(PORT, () => {
    console.log(`Hi-Lo server running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
