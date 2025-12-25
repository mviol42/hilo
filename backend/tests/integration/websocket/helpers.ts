/**
 * WebSocket testing utilities
 */

import { io as ioClient, Socket } from 'socket.io-client';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  LobbyJoinEvent,
} from '@hilo/shared';
import { TEST_PORT } from '../setup';

export type TestSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Create a Socket.IO client connection
 */
export function createSocketClient(): TestSocket {
  const socket = ioClient(`http://localhost:${TEST_PORT}`, {
    transports: ['websocket'],
    autoConnect: false,
  });

  return socket;
}

/**
 * Connect a socket client and wait for connection
 */
export async function connectSocket(socket: TestSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Socket connection timeout'));
    }, 5000);

    socket.once('connect', () => {
      clearTimeout(timeout);
      resolve();
    });

    socket.once('connect_error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    socket.connect();
  });
}

/**
 * Disconnect a socket and wait for disconnection
 */
export async function disconnectSocket(socket: TestSocket): Promise<void> {
  return new Promise((resolve) => {
    if (!socket.connected) {
      resolve();
      return;
    }

    socket.once('disconnect', () => {
      resolve();
    });

    socket.disconnect();
  });
}

/**
 * Wait for a specific event on a socket
 */
export function waitForEvent<K extends keyof ServerToClientEvents>(
  socket: TestSocket,
  eventName: K,
  timeoutMs = 5000
): Promise<Parameters<ServerToClientEvents[K]>[0]> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${String(eventName)}`));
    }, timeoutMs);

    // Type assertion needed due to Socket.IO's complex generic types
    (socket as any).once(eventName, (data: any) => {
      clearTimeout(timeout);
      resolve(data);
    });
  });
}

/**
 * Join a lobby via WebSocket
 */
export async function joinLobby(
  socket: TestSocket,
  lobbyId: string,
  playerId: string
): Promise<void> {
  const joinData: LobbyJoinEvent = {
    lobbyId,
    playerId,
  };

  socket.emit('lobby:join', joinData);

  // Wait for confirmation (playerJoined event)
  await waitForEvent(socket, 'lobby:playerJoined');
}

/**
 * Leave a lobby via WebSocket
 */
export async function leaveLobby(
  socket: TestSocket,
  lobbyId: string,
  playerId: string
): Promise<void> {
  socket.emit('lobby:leave', { lobbyId, playerId });

  // Give it a moment to process
  await new Promise((resolve) => setTimeout(resolve, 20));
}

/**
 * Create and connect multiple socket clients
 */
export async function createAndConnectSockets(count: number): Promise<TestSocket[]> {
  const sockets: TestSocket[] = [];

  for (let i = 0; i < count; i++) {
    const socket = createSocketClient();
    await connectSocket(socket);
    sockets.push(socket);
  }

  return sockets;
}

/**
 * Disconnect multiple sockets
 */
export async function disconnectSockets(sockets: TestSocket[]): Promise<void> {
  await Promise.all(sockets.map((socket) => disconnectSocket(socket)));
}

/**
 * Clean up sockets after test
 */
export async function cleanupSockets(sockets: TestSocket[]): Promise<void> {
  for (const socket of sockets) {
    socket.removeAllListeners();
    await disconnectSocket(socket);
  }
}
