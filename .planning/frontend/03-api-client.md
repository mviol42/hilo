# Task 3: API Client and WebSocket Manager

## Goal

Create HTTP API client for game actions and WebSocket manager for real-time updates.

## Prerequisites

- Task 1: Project Setup completed
- axios and socket.io-client installed
- Backend server running

## Architecture

- **HTTP API**: All mutations (create, join, play cards, etc.)
- **WebSocket**: Read-only state updates and events
- **Type Safety**: Use `@hilo/shared` types for all API calls

## Implementation

### 1. Create HTTP API Client

Create `src/services/api.ts`:
```typescript
import axios, { AxiosInstance, AxiosError } from 'axios'
import type {
  CreateLobbyResponse,
  JoinLobbyRequest,
  JoinLobbyResponse,
  ReadyLobbyRequest,
  ReadyLobbyResponse,
  LeaveLobbyRequest,
  LeaveLobbyResponse,
  StartGameRequest,
  StartGameResponse,
  SelectFaceUpRequest,
  SelectFaceUpResponse,
  PlayCardsRequest,
  PlayCardsResponse,
  PickUpPileRequest,
  PickUpPileResponse,
  ErrorResponse,
} from '@hilo/shared'
import { config } from '@/config'

class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: config.apiUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    })

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ErrorResponse>) => {
        console.error('API Error:', error.response?.data || error.message)
        throw error
      }
    )
  }

  // Lobby endpoints

  async createLobby(): Promise<CreateLobbyResponse> {
    const response = await this.client.post<CreateLobbyResponse>('/api/lobby/create')
    return response.data
  }

  async joinLobby(request: JoinLobbyRequest): Promise<JoinLobbyResponse> {
    const response = await this.client.post<JoinLobbyResponse>('/api/lobby/join', request)
    return response.data
  }

  async readyLobby(request: ReadyLobbyRequest): Promise<ReadyLobbyResponse> {
    const response = await this.client.post<ReadyLobbyResponse>('/api/lobby/ready', request)
    return response.data
  }

  async leaveLobby(request: LeaveLobbyRequest): Promise<LeaveLobbyResponse> {
    const response = await this.client.post<LeaveLobbyResponse>('/api/lobby/leave', request)
    return response.data
  }

  // Game endpoints

  async startGame(request: StartGameRequest): Promise<StartGameResponse> {
    const response = await this.client.post<StartGameResponse>('/api/game/start', request)
    return response.data
  }

  async selectFaceUp(request: SelectFaceUpRequest): Promise<SelectFaceUpResponse> {
    const response = await this.client.post<SelectFaceUpResponse>('/api/game/select-faceup', request)
    return response.data
  }

  async playCards(request: PlayCardsRequest): Promise<PlayCardsResponse> {
    const response = await this.client.post<PlayCardsResponse>('/api/game/play-cards', request)
    return response.data
  }

  async pickUpPile(request: PickUpPileRequest): Promise<PickUpPileResponse> {
    const response = await this.client.post<PickUpPileResponse>('/api/game/pickup-pile', request)
    return response.data
  }
}

export const apiClient = new ApiClient()
```

### 2. Create WebSocket Manager

Create `src/services/socket.ts`:
```typescript
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
```

### 3. Create Custom Hooks for API

Create `src/hooks/useApi.ts`:
```typescript
import { useState, useCallback } from 'react'
import { AxiosError } from 'axios'
import type { ErrorResponse } from '@hilo/shared'

export function useApi<T, P extends any[]>(
  apiFunction: (...args: P) => Promise<T>
) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<T | null>(null)

  const execute = useCallback(
    async (...args: P) => {
      setLoading(true)
      setError(null)

      try {
        const result = await apiFunction(...args)
        setData(result)
        return result
      } catch (err) {
        const axiosError = err as AxiosError<ErrorResponse>
        const errorMessage = axiosError.response?.data?.message || axiosError.message
        setError(errorMessage)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [apiFunction]
  )

  const reset = useCallback(() => {
    setLoading(false)
    setError(null)
    setData(null)
  }, [])

  return { execute, loading, error, data, reset }
}
```

### 4. Create Custom Hook for WebSocket

Create `src/hooks/useSocket.ts`:
```typescript
import { useEffect, useRef } from 'react'
import { socketManager, SocketEventHandler } from '@/services/socket'

export function useSocket() {
  const isConnected = useRef(false)

  useEffect(() => {
    if (!isConnected.current) {
      socketManager.connect()
      isConnected.current = true
    }

    return () => {
      socketManager.disconnect()
      isConnected.current = false
    }
  }, [])

  return socketManager
}

export function useSocketEvent<T>(
  eventName: keyof typeof socketManager,
  handler: SocketEventHandler<T>
) {
  const socket = useSocket()

  useEffect(() => {
    if (typeof socket[eventName] === 'function') {
      // @ts-ignore - Dynamic method call
      const cleanup = socket[eventName](handler)
      return cleanup
    }
  }, [socket, eventName, handler])
}
```

### 5. Create Player ID Utility

Create `src/utils/player.ts`:
```typescript
import { v4 as uuidv4 } from 'uuid'

const PLAYER_ID_KEY = 'hilo:playerId'
const PLAYER_NAME_KEY = 'hilo:playerName'

/**
 * Get or create player ID
 */
export function getPlayerId(): string {
  let playerId = localStorage.getItem(PLAYER_ID_KEY)

  if (!playerId) {
    playerId = uuidv4()
    localStorage.setItem(PLAYER_ID_KEY, playerId)
  }

  return playerId
}

/**
 * Get stored player name
 */
export function getPlayerName(): string | null {
  return localStorage.getItem(PLAYER_NAME_KEY)
}

/**
 * Save player name
 */
export function savePlayerName(name: string): void {
  localStorage.setItem(PLAYER_NAME_KEY, name)
}

/**
 * Clear player data (for testing/logout)
 */
export function clearPlayerData(): void {
  localStorage.removeItem(PLAYER_ID_KEY)
  localStorage.removeItem(PLAYER_NAME_KEY)
}
```

## Testing

Create `src/services/__tests__/api.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { apiClient } from '../api'

vi.mock('axios')

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates lobby successfully', async () => {
    const mockResponse = { lobbyId: 'test-lobby-123' }
    vi.mocked(axios.create).mockReturnValue({
      post: vi.fn().mockResolvedValue({ data: mockResponse }),
    } as any)

    const result = await apiClient.createLobby()
    expect(result).toEqual(mockResponse)
  })

  it('handles API errors', async () => {
    const mockError = {
      response: {
        data: { error: 'Not found', message: 'Lobby not found' },
      },
    }
    vi.mocked(axios.create).mockReturnValue({
      post: vi.fn().mockRejectedValue(mockError),
    } as any)

    await expect(apiClient.createLobby()).rejects.toThrow()
  })
})
```

## Error Handling

### HTTP API Errors

```typescript
try {
  await apiClient.joinLobby(request)
} catch (error) {
  const axiosError = error as AxiosError<ErrorResponse>

  if (axiosError.response?.status === 404) {
    // Lobby not found
    showError('Lobby not found')
  } else if (axiosError.response?.status === 409) {
    // Conflict (already in lobby, game started, etc.)
    showError(axiosError.response.data.message)
  } else {
    // Generic error
    showError('An error occurred. Please try again.')
  }
}
```

### WebSocket Errors

```typescript
socket.onError((data) => {
  console.error('[Socket] Error:', data.message)
  showToast('Connection error: ' + data.message, 'error')
})
```

## Output Files

- `/frontend/src/services/api.ts` - HTTP API client
- `/frontend/src/services/socket.ts` - WebSocket manager
- `/frontend/src/hooks/useApi.ts` - API hook
- `/frontend/src/hooks/useSocket.ts` - WebSocket hooks
- `/frontend/src/utils/player.ts` - Player ID utilities

## Next Steps

- Task 4: Implement state management
- Task 5: Use API client in Landing Page
- Task 6: Use API client and WebSocket in Lobby Page
- Task 7: Use API client and WebSocket in Game Page

## Notes

- All API calls use types from `@hilo/shared` for type safety
- WebSocket is read-only; all mutations go through HTTP API
- Player ID is auto-generated on first visit and persisted
- Error handling is centralized in the API client
- WebSocket auto-reconnects on disconnect
