import { io, Socket } from 'socket.io-client';
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@hilo/shared/types/events';
import { logger } from './logger';

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export class SocketClient {
  private socket: TypedSocket;

  constructor(serverURL: string = 'http://localhost:3000') {
    this.socket = io(serverURL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.setupLogging();
    this.setupErrorHandling();
  }

  private setupLogging(): void {
    // Log all incoming events
    this.socket.onAny((eventName, ...args) => {
      logger.info(
        `Socket Message Received: ${JSON.stringify({
          eventName,
          payload: args,
          socketId: this.socket.id,
          timestamp: new Date().toISOString(),
        })}`
      );
    });

    // Log all outgoing events
    this.socket.onAnyOutgoing((eventName, ...args) => {
      logger.info(
        `Socket Message Sent: ${JSON.stringify({
          eventName,
          payload: args,
          socketId: this.socket.id,
          timestamp: new Date().toISOString(),
        })}`
      );
    });

    // Log connection events
    this.socket.on('connect', () => {
      logger.info(
        `Socket Connected: ${JSON.stringify({
          socketId: this.socket.id,
          timestamp: new Date().toISOString(),
        })}`
      );
    });

    this.socket.on('disconnect', (reason) => {
      logger.info(
        `Socket Disconnected: ${JSON.stringify({
          socketId: this.socket.id,
          reason,
          timestamp: new Date().toISOString(),
        })}`
      );
    });
  }

  private setupErrorHandling(): void {
    this.socket.on('connect_error', (error) => {
      logger.error(`Connection error: ${error.message}`);
    });

    this.socket.on('error', (data) => {
      logger.error(`Server error: ${data.message}`);
    });
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.connect();

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 5000);

      this.socket.once('connect', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.socket.once('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  disconnect(): void {
    this.socket.disconnect();
  }

  on<K extends keyof ServerToClientEvents>(
    event: K,
    listener: ServerToClientEvents[K]
  ): void {
    this.socket.on(event, listener as any);
  }

  off<K extends keyof ServerToClientEvents>(
    event: K,
    listener?: ServerToClientEvents[K]
  ): void {
    if (listener) {
      this.socket.off(event, listener as any);
    } else {
      this.socket.off(event);
    }
  }

  once<K extends keyof ServerToClientEvents>(
    event: K,
    listener: ServerToClientEvents[K]
  ): void {
    this.socket.once(event, listener as any);
  }

  /**
   * Emit an event to the server
   * NOTE: Only for subscribing to rooms, not for mutations.
   * All mutations must go through the HTTP API.
   */
  emit<K extends keyof ClientToServerEvents>(
    event: K,
    data: Parameters<ClientToServerEvents[K]>[0]
  ): void {
    (this.socket.emit as any)(event, data);
  }
}
