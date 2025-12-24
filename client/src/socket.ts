import { io, Socket } from 'socket.io-client';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  LobbyJoinEvent,
  GamePlayCardsEvent,
  GamePickUpPileEvent,
  GameSelectFaceUpEvent,
} from '@hilo/shared/types/events';
import { LobbyId } from '@hilo/shared/types/lobby';
import { PlayerId } from '@hilo/shared/types/player';
import { Card } from '@hilo/shared/types/card';

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

    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error.message);
    });

    this.socket.on('error', (data) => {
      console.error('Server error:', data.message);
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

  joinLobby(lobbyId: LobbyId, playerName?: string): void {
    this.socket.emit('lobby:join', { lobbyId, playerName });
  }

  leaveLobby(lobbyId: LobbyId, playerId: PlayerId): void {
    this.socket.emit('lobby:leave', { lobbyId, playerId });
  }

  selectFaceUp(gameId: string, playerId: PlayerId, cards: Card[]): void {
    this.socket.emit('game:selectFaceUp', { gameId, playerId, cards });
  }

  playCards(gameId: string, playerId: PlayerId, cards: Card[]): void {
    this.socket.emit('game:playCards', { gameId, playerId, cards });
  }

  pickUpPile(gameId: string, playerId: PlayerId): void {
    this.socket.emit('game:pickUpPile', { gameId, playerId });
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
}
