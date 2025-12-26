import { io, Socket } from 'socket.io-client'
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  LobbyPlayerJoinedEvent,
  LobbyPlayerReadiedEvent,
  LobbyPlayerLeftEvent,
  LobbyLeaderChangedEvent,
  LobbyGameStartingEvent,
  GameStateUpdateEvent,
  GameTurnChangeEvent,
  GamePileBlownEvent,
  GamePlayerWonEvent,
  ErrorEvent,
} from '@hilo/shared'
import { config } from '@/config'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export type SocketEventHandler<T> = (data: T) => void

class SocketManager {
  private socket: TypedSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5

  connect(): TypedSocket {
    if (this.socket?.connected) {
      return this.socket
    }

    this.socket = io(config.wsUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
    })

    this.setupConnectionHandlers()

    return this.socket
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  private setupConnectionHandlers(): void {
    if (!this.socket) return

    this.socket.on('connect', () => {
      console.log('[Socket] Connected')
      this.reconnectAttempts = 0
    })

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason)
    })

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error)
      this.reconnectAttempts++
    })
  }

  // Join lobby room
  joinLobby(lobbyId: string, playerId: string): void {
    if (!this.socket) {
      throw new Error('Socket not connected')
    }
    this.socket.emit('lobby:join', { lobbyId, playerId })
  }

  // Leave lobby room
  leaveLobby(lobbyId: string, playerId: string): void {
    if (!this.socket) return
    this.socket.emit('lobby:leave', { lobbyId, playerId })
  }

  // Event listeners

  onLobbyPlayerJoined(handler: SocketEventHandler<LobbyPlayerJoinedEvent>): () => void {
    if (!this.socket) throw new Error('Socket not connected')
    this.socket.on('lobby:playerJoined', handler)
    return () => this.socket?.off('lobby:playerJoined', handler)
  }

  onLobbyPlayerReadied(handler: SocketEventHandler<LobbyPlayerReadiedEvent>): () => void {
    if (!this.socket) throw new Error('Socket not connected')
    this.socket.on('lobby:playerReadied', handler)
    return () => this.socket?.off('lobby:playerReadied', handler)
  }

  onLobbyPlayerLeft(handler: SocketEventHandler<LobbyPlayerLeftEvent>): () => void {
    if (!this.socket) throw new Error('Socket not connected')
    this.socket.on('lobby:playerLeft', handler)
    return () => this.socket?.off('lobby:playerLeft', handler)
  }

  onLobbyLeaderChanged(handler: SocketEventHandler<LobbyLeaderChangedEvent>): () => void {
    if (!this.socket) throw new Error('Socket not connected')
    this.socket.on('lobby:leaderChanged', handler)
    return () => this.socket?.off('lobby:leaderChanged', handler)
  }

  onLobbyGameStarting(handler: SocketEventHandler<LobbyGameStartingEvent>): () => void {
    if (!this.socket) throw new Error('Socket not connected')
    this.socket.on('lobby:gameStarting', handler)
    return () => this.socket?.off('lobby:gameStarting', handler)
  }

  onGameStateUpdate(handler: SocketEventHandler<GameStateUpdateEvent>): () => void {
    if (!this.socket) throw new Error('Socket not connected')
    this.socket.on('game:stateUpdate', handler)
    return () => this.socket?.off('game:stateUpdate', handler)
  }

  onGameTurnChange(handler: SocketEventHandler<GameTurnChangeEvent>): () => void {
    if (!this.socket) throw new Error('Socket not connected')
    this.socket.on('game:turnChange', handler)
    return () => this.socket?.off('game:turnChange', handler)
  }

  onGamePileBlown(handler: SocketEventHandler<GamePileBlownEvent>): () => void {
    if (!this.socket) throw new Error('Socket not connected')
    this.socket.on('game:pileBlown', handler)
    return () => this.socket?.off('game:pileBlown', handler)
  }

  onGamePlayerWon(handler: SocketEventHandler<GamePlayerWonEvent>): () => void {
    if (!this.socket) throw new Error('Socket not connected')
    this.socket.on('game:playerWon', handler)
    return () => this.socket?.off('game:playerWon', handler)
  }

  onError(handler: SocketEventHandler<ErrorEvent>): () => void {
    if (!this.socket) throw new Error('Socket not connected')
    this.socket.on('error', handler)
    return () => this.socket?.off('error', handler)
  }

  isConnected(): boolean {
    return this.socket?.connected || false
  }
}

export const socketManager = new SocketManager()
