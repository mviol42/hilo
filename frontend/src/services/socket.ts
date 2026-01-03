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
  private socket: TypedSocket
  private maxReconnectAttempts = 10
  private connectionState: ConnectionState = 'disconnected'
  private reconnectAttempt = 0
  private connectionStateHandlers: Set<ConnectionStateHandler> = new Set()

  // Store lobby/game info for auto-rejoin after reconnection
  private currentLobbyId: string | null = null
  private currentPlayerId: string | null = null
  private currentGameId: string | null = null

  constructor() {
    // Create socket instance immediately with autoConnect disabled
    // This allows listeners to be registered before connection
    this.socket = io(config.wsUrl, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (capped)
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.5,
      reconnectionAttempts: this.maxReconnectAttempts,
    })

    this.setupConnectionHandlers()
  }

  connect(): TypedSocket {
    if (this.socket.connected) {
      return this.socket
    }

    console.log('[SocketManager] Manually connecting socket...')
    this.updateConnectionState('connecting')

    // Manually trigger connection
    this.socket.connect()

    return this.socket
  }

  disconnect(): void {
    this.socket.disconnect()
    this.currentLobbyId = null
    this.currentPlayerId = null
    this.currentGameId = null
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
    this.socket.on('connect', () => {
      console.log('[Socket] Connected')
      this.reconnectAttempt = 0
      this.updateConnectionState('connected')

      // Auto-rejoin lobby if we were in one
      if (this.currentLobbyId && this.currentPlayerId) {
        console.log('[Socket] Auto-rejoining lobby:', this.currentLobbyId)
        this.socket?.emit('lobby:join', {
          lobbyId: this.currentLobbyId,
          playerId: this.currentPlayerId,
        })

        // Request game state if we were in a game (for immediate recovery)
        if (this.currentGameId) {
          console.log('[Socket] Requesting game state:', this.currentGameId)
          this.socket?.emit('game:requestState', {
            gameId: this.currentGameId,
            playerId: this.currentPlayerId,
          })
        }
      }
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

  // Join lobby room (stores for auto-rejoin)
  joinLobby(lobbyId: string, playerId: string): void {
    // Store for auto-rejoin after reconnection
    this.currentLobbyId = lobbyId
    this.currentPlayerId = playerId
    this.socket.emit('lobby:join', { lobbyId, playerId })
  }

  // Leave lobby room
  leaveLobby(lobbyId: string, playerId: string): void {
    // Clear stored lobby info
    if (this.currentLobbyId === lobbyId) {
      this.currentLobbyId = null
      this.currentPlayerId = null
    }
    this.socket.emit('lobby:leave', { lobbyId, playerId })
  }

  // Get current lobby ID (for checking if user is in a lobby)
  getCurrentLobbyId(): string | null {
    return this.currentLobbyId
  }

  // Set current game ID (called when game starts)
  setCurrentGameId(gameId: string): void {
    this.currentGameId = gameId
  }

  // Clear current game ID (called when game ends or player leaves)
  clearCurrentGameId(): void {
    this.currentGameId = null
  }

  // Get current game ID
  getCurrentGameId(): string | null {
    return this.currentGameId
  }

  // Request game state (for manual recovery or initial load)
  requestGameState(gameId: string, playerId: string): void {
    this.socket.emit('game:requestState', { gameId, playerId })
  }

  // Event listeners

  onLobbyPlayerJoined(handler: SocketEventHandler<LobbyPlayerJoinedEvent>): () => void {
    this.socket.on('lobby:playerJoined', handler)
    return () => this.socket.off('lobby:playerJoined', handler)
  }

  onLobbyPlayerReadied(handler: SocketEventHandler<LobbyPlayerReadiedEvent>): () => void {
    this.socket.on('lobby:playerReadied', handler)
    return () => this.socket.off('lobby:playerReadied', handler)
  }

  onLobbyPlayerLeft(handler: SocketEventHandler<LobbyPlayerLeftEvent>): () => void {
    this.socket.on('lobby:playerLeft', handler)
    return () => this.socket.off('lobby:playerLeft', handler)
  }

  onLobbyLeaderChanged(handler: SocketEventHandler<LobbyLeaderChangedEvent>): () => void {
    this.socket.on('lobby:leaderChanged', handler)
    return () => this.socket.off('lobby:leaderChanged', handler)
  }

  onLobbyGameStarting(handler: SocketEventHandler<LobbyGameStartingEvent>): () => void {
    this.socket.on('lobby:gameStarting', handler)
    return () => this.socket.off('lobby:gameStarting', handler)
  }

  onGameStateUpdate(handler: SocketEventHandler<GameStateUpdateEvent>): () => void {
    this.socket.on('game:stateUpdate', handler)
    return () => this.socket.off('game:stateUpdate', handler)
  }

  onGameTurnChange(handler: SocketEventHandler<GameTurnChangeEvent>): () => void {
    this.socket.on('game:turnChange', handler)
    return () => this.socket.off('game:turnChange', handler)
  }

  onGamePlayerWon(handler: SocketEventHandler<GamePlayerWonEvent>): () => void {
    this.socket.on('game:playerWon', handler)
    return () => this.socket.off('game:playerWon', handler)
  }

  onError(handler: SocketEventHandler<ErrorEvent>): () => void {
    this.socket.on('error', handler)
    return () => this.socket.off('error', handler)
  }

  isConnected(): boolean {
    return this.socket.connected
  }
}

export const socketManager = new SocketManager()
