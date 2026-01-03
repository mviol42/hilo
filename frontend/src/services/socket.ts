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
import {
  getPlayerId,
  getLobbyId,
  saveLobbyId,
  clearLobbyId,
  getGameId,
  saveGameId,
  clearGameId,
} from '@/utils/player'

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

  // Store lobby/game info for auto-rejoin after reconnection
  // These are initialized from localStorage to survive page refreshes
  private currentLobbyId: string | null = null
  private currentPlayerId: string | null = null
  private currentGameId: string | null = null

  constructor() {
    // Restore session from localStorage for page refresh recovery
    this.currentPlayerId = getPlayerId()
    this.currentLobbyId = getLobbyId()
    this.currentGameId = getGameId()
  }

  /**
   * Initialize the socket (but don't connect yet).
   * This allows listeners to be registered before connection.
   */
  private ensureSocketExists(): void {
    if (this.socket) return

    // Create socket with autoConnect: false to prevent immediate connection
    // Listeners can be attached before calling connect()
    this.socket = io(config.wsUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.5,
      reconnectionAttempts: this.maxReconnectAttempts,
      autoConnect: false, // Critical: don't connect until listeners are attached
    })

    this.setupConnectionHandlers()
  }

  connect(): TypedSocket {
    if (this.socket?.connected) {
      return this.socket
    }

    // Ensure socket exists (listeners already attached via registerListener)
    this.ensureSocketExists()

    // Connect - all listeners are ready
    this.updateConnectionState('connecting')
    this.socket!.connect()

    return this.socket!
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.currentLobbyId = null
    this.currentPlayerId = null
    this.currentGameId = null
    // Clear localStorage session data
    clearLobbyId()
    clearGameId()
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

      // Auto-rejoin lobby if we were in one
      if (this.currentLobbyId && this.currentPlayerId) {
        console.log('[Socket] Auto-rejoining lobby:', this.currentLobbyId)
        this.socket?.emit('lobby:join', {
          lobbyId: this.currentLobbyId,
          playerId: this.currentPlayerId,
        })

        // If we're in an active game, request current state
        // Listeners are guaranteed to be ready at this point
        if (this.currentGameId) {
          console.log('[Socket] Requesting game state for game:', this.currentGameId)
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
    if (!this.socket) {
      throw new Error('Socket not connected')
    }
    // Store for auto-rejoin after reconnection (both memory and localStorage)
    this.currentLobbyId = lobbyId
    this.currentPlayerId = playerId
    saveLobbyId(lobbyId)
    this.socket.emit('lobby:join', { lobbyId, playerId })
  }

  // Leave lobby room
  leaveLobby(lobbyId: string, playerId: string): void {
    if (!this.socket) return
    // Clear stored lobby info (both memory and localStorage)
    if (this.currentLobbyId === lobbyId) {
      this.currentLobbyId = null
      this.currentPlayerId = null
      clearLobbyId()
      clearGameId()
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
    saveGameId(gameId)
  }

  // Clear current game ID (called when game ends or player leaves)
  clearCurrentGameId(): void {
    this.currentGameId = null
    clearGameId()
  }

  // Get current game ID
  getCurrentGameId(): string | null {
    return this.currentGameId
  }

  // Request game state (for manual recovery or initial load)
  requestGameState(gameId: string, playerId: string): void {
    if (!this.socket) {
      throw new Error('Socket not connected')
    }
    this.socket.emit('game:requestState', { gameId, playerId })
  }

  // Event listeners - can be called before socket is connected

  /**
   * Register an event listener.
   * Ensures socket exists and attaches the listener immediately.
   * Since socket is created with autoConnect: false, listeners are
   * attached before connection happens (coordinated by AppProviders).
   */
  private registerListener<T>(event: string, handler: SocketEventHandler<T>): () => void {
    // Ensure socket is created (but not yet connected)
    this.ensureSocketExists()

    // Attach listener directly - socket won't connect until connect() is called
    this.socket!.on(event as any, handler as any)

    // Return cleanup function
    return () => {
      this.socket?.off(event as any, handler as any)
    }
  }

  onLobbyPlayerJoined(handler: SocketEventHandler<LobbyPlayerJoinedEvent>): () => void {
    return this.registerListener('lobby:playerJoined', handler)
  }

  onLobbyPlayerReadied(handler: SocketEventHandler<LobbyPlayerReadiedEvent>): () => void {
    return this.registerListener('lobby:playerReadied', handler)
  }

  onLobbyPlayerLeft(handler: SocketEventHandler<LobbyPlayerLeftEvent>): () => void {
    return this.registerListener('lobby:playerLeft', handler)
  }

  onLobbyLeaderChanged(handler: SocketEventHandler<LobbyLeaderChangedEvent>): () => void {
    return this.registerListener('lobby:leaderChanged', handler)
  }

  onLobbyGameStarting(handler: SocketEventHandler<LobbyGameStartingEvent>): () => void {
    return this.registerListener('lobby:gameStarting', handler)
  }

  onGameStateUpdate(handler: SocketEventHandler<GameStateUpdateEvent>): () => void {
    return this.registerListener('game:stateUpdate', handler)
  }

  onGameTurnChange(handler: SocketEventHandler<GameTurnChangeEvent>): () => void {
    return this.registerListener('game:turnChange', handler)
  }

  onGamePlayerWon(handler: SocketEventHandler<GamePlayerWonEvent>): () => void {
    return this.registerListener('game:playerWon', handler)
  }

  onError(handler: SocketEventHandler<ErrorEvent>): () => void {
    return this.registerListener('error', handler)
  }

  isConnected(): boolean {
    return this.socket?.connected || false
  }
}

export const socketManager = new SocketManager()
