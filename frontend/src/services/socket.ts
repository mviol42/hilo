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
  GamePlayerWonEvent,
  ErrorEvent,
} from '@hilo/shared'
import { config } from '@/config'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export type SocketEventHandler<T> = (data: T) => void

// Connection states for UI feedback
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

export interface ConnectionInfo {
  state: ConnectionState
  reconnectAttempt: number
  maxAttempts: number
}

type ConnectionStateHandler = (info: ConnectionInfo) => void

class SocketManager {
  private socket: TypedSocket | null = null
  private maxReconnectAttempts = 10
  private connectionState: ConnectionState = 'disconnected'
  private reconnectAttempt = 0
  private connectionStateHandlers: Set<ConnectionStateHandler> = new Set()

  connect(): TypedSocket {
    if (this.socket?.connected) {
      return this.socket
    }

    this.updateConnectionState('connecting')

    this.socket = io(config.wsUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (capped)
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.5,
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
    this.updateConnectionState('disconnected')
  }

  private updateConnectionState(state: ConnectionState): void {
    this.connectionState = state
    const info: ConnectionInfo = {
      state,
      reconnectAttempt: this.reconnectAttempt,
      maxAttempts: this.maxReconnectAttempts,
    }
    this.connectionStateHandlers.forEach((handler) => handler(info))
  }

  private setupConnectionHandlers(): void {
    if (!this.socket) return

    this.socket.on('connect', () => {
      console.log('[Socket] Connected')
      this.reconnectAttempt = 0
      this.updateConnectionState('connected')
      // Pages will handle rejoin via useSessionRejoin hook
    })

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason)
      // If the server disconnected us, we won't reconnect automatically
      if (reason === 'io server disconnect') {
        this.updateConnectionState('disconnected')
      }
      // For other reasons, Socket.IO will attempt to reconnect
    })

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error)
    })

    // Manager-level events for reconnection tracking
    // These are emitted by the Manager, not the Socket
    this.socket.io.on('reconnect_attempt', (attempt) => {
      console.log(`[Socket] Reconnection attempt ${attempt}/${this.maxReconnectAttempts}`)
      this.reconnectAttempt = attempt
      this.updateConnectionState('reconnecting')
    })

    this.socket.io.on('reconnect', (attempt) => {
      console.log(`[Socket] Reconnected after ${attempt} attempts`)
      this.reconnectAttempt = 0
      this.updateConnectionState('connected')
    })

    this.socket.io.on('reconnect_failed', () => {
      console.error('[Socket] Reconnection failed after max attempts')
      this.updateConnectionState('disconnected')
    })
  }

  // Subscribe to connection state changes
  onConnectionStateChange(handler: ConnectionStateHandler): () => void {
    this.connectionStateHandlers.add(handler)
    // Immediately call with current state
    handler({
      state: this.connectionState,
      reconnectAttempt: this.reconnectAttempt,
      maxAttempts: this.maxReconnectAttempts,
    })
    return () => {
      this.connectionStateHandlers.delete(handler)
    }
  }

  // Get current connection info
  getConnectionInfo(): ConnectionInfo {
    return {
      state: this.connectionState,
      reconnectAttempt: this.reconnectAttempt,
      maxAttempts: this.maxReconnectAttempts,
    }
  }

  // Manual retry after max attempts reached
  retryConnection(): void {
    if (this.connectionState !== 'disconnected') {
      return
    }
    this.reconnectAttempt = 0
    this.socket?.connect()
    this.updateConnectionState('connecting')
  }

  /**
   * Join a session with explicit IDs.
   * Used for both first-time connections and reconnections.
   * @param playerId - Player ID from localStorage
   * @param lobbyId - Lobby ID from URL or API response
   * @param gameId - Optional game ID if joining active game
   */
  joinSession(playerId: string, lobbyId: string, gameId?: string): void {
    if (!this.socket) {
      throw new Error('Socket not connected')
    }

    // Join lobby room
    console.log('[Socket] Joining lobby:', lobbyId)
    this.socket.emit('lobby:join', { lobbyId, playerId })

    // Request game state if in active game
    if (gameId) {
      console.log('[Socket] Requesting game state:', gameId)
      this.socket.emit('game:requestState', { gameId, playerId })
    }
  }

  // Leave lobby room
  leaveLobby(lobbyId: string, playerId: string): void {
    if (!this.socket) return
    this.socket.emit('lobby:leave', { lobbyId, playerId })
  }

  // Request game state (for manual recovery or initial load)
  requestGameState(gameId: string, playerId: string): void {
    if (!this.socket) {
      throw new Error('Socket not connected')
    }
    this.socket.emit('game:requestState', { gameId, playerId })
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
