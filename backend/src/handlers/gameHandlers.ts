/**
 * Socket.IO event handlers for game actions
 *
 * NOTE: WebSockets are READ-ONLY. All mutations are handled via HTTP API.
 * See /docs/backend-design.md for the architectural rule.
 */

import { Server, Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@hilo/shared';

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/**
 * Register all game-related event handlers
 * Currently empty as all game mutations are handled via HTTP API
 */
export function registerGameHandlers(_io: TypedServer, _socket: TypedSocket): void {
  // No game mutation handlers - all mutations are via HTTP API
  // WebSocket only broadcasts state updates from the server
}

