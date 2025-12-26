# Task 4: State Management

## Goal

Design and implement global state management for lobby and game state using React Context and useReducer.

## Prerequisites

- Task 1: Project Setup completed
- Task 3: API Client and WebSocket Manager completed

## State Architecture

### Global State Layers

1. **Player State**: Current player's ID and name (persisted to localStorage)
2. **Lobby State**: Current lobby information (from API + WebSocket updates)
3. **Game State**: Current game state (PlayerView from API + WebSocket updates)
4. **UI State**: Loading indicators, modals, toasts

## Implementation

### 1. Create Player Context

Create `src/context/PlayerContext.tsx`:
```typescript
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getPlayerId, getPlayerName, savePlayerName } from '@/utils/player'

interface PlayerContextValue {
  playerId: string
  playerName: string | null
  setPlayerName: (name: string) => void
}

const PlayerContext = createContext<PlayerContextValue | undefined>(undefined)

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [playerId] = useState(() => getPlayerId())
  const [playerName, setPlayerNameState] = useState<string | null>(() => getPlayerName())

  const handleSetPlayerName = (name: string) => {
    savePlayerName(name)
    setPlayerNameState(name)
  }

  return (
    <PlayerContext.Provider
      value={{
        playerId,
        playerName,
        setPlayerName: handleSetPlayerName,
      }}
    >
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const context = useContext(PlayerContext)
  if (!context) {
    throw new Error('usePlayer must be used within PlayerProvider')
  }
  return context
}
```

### 2. Create Lobby Context

Create `src/context/LobbyContext.tsx`:
```typescript
import { createContext, useContext, useReducer, useEffect, ReactNode, Dispatch } from 'react'
import type { LobbyState, PlayerId, Player } from '@hilo/shared'
import { useSocket } from '@/hooks/useSocket'
import { usePlayer } from './PlayerContext'

interface LobbyContextState {
  lobby: LobbyState | null
  isLeader: boolean
  connectedToLobby: boolean
}

type LobbyAction =
  | { type: 'SET_LOBBY'; payload: LobbyState }
  | { type: 'CLEAR_LOBBY' }
  | { type: 'PLAYER_JOINED'; payload: { player: Player; lobby: LobbyState } }
  | { type: 'PLAYER_LEFT'; payload: { playerId: PlayerId; lobby: LobbyState } }
  | { type: 'PLAYER_READIED'; payload: { player: Player; lobby: LobbyState } }
  | { type: 'LEADER_CHANGED'; payload: { newLeaderId: PlayerId; lobby: LobbyState } }
  | { type: 'SET_CONNECTED'; payload: boolean }

function lobbyReducer(state: LobbyContextState, action: LobbyAction): LobbyContextState {
  switch (action.type) {
    case 'SET_LOBBY':
      return {
        ...state,
        lobby: action.payload,
        connectedToLobby: true,
      }
    case 'CLEAR_LOBBY':
      return {
        lobby: null,
        isLeader: false,
        connectedToLobby: false,
      }
    case 'PLAYER_JOINED':
    case 'PLAYER_LEFT':
    case 'PLAYER_READIED':
    case 'LEADER_CHANGED':
      return {
        ...state,
        lobby: action.payload.lobby,
      }
    case 'SET_CONNECTED':
      return {
        ...state,
        connectedToLobby: action.payload,
      }
    default:
      return state
  }
}

interface LobbyContextValue extends LobbyContextState {
  dispatch: Dispatch<LobbyAction>
}

const LobbyContext = createContext<LobbyContextValue | undefined>(undefined)

export function LobbyProvider({ children }: { children: ReactNode }) {
  const { playerId } = usePlayer()
  const socket = useSocket()

  const [state, dispatch] = useReducer(lobbyReducer, {
    lobby: null,
    isLeader: false,
    connectedToLobby: false,
  })

  // Compute isLeader when lobby changes
  const isLeader = state.lobby?.leaderId === playerId

  // Set up WebSocket listeners
  useEffect(() => {
    const cleanupFns: Array<() => void> = []

    cleanupFns.push(
      socket.onLobbyPlayerJoined((data) => {
        dispatch({ type: 'PLAYER_JOINED', payload: data })
      })
    )

    cleanupFns.push(
      socket.onLobbyPlayerLeft((data) => {
        dispatch({ type: 'PLAYER_LEFT', payload: data })
      })
    )

    cleanupFns.push(
      socket.onLobbyPlayerReadied((data) => {
        dispatch({ type: 'PLAYER_READIED', payload: data })
      })
    )

    cleanupFns.push(
      socket.onLobbyLeaderChanged((data) => {
        dispatch({ type: 'LEADER_CHANGED', payload: data })
      })
    )

    return () => {
      cleanupFns.forEach((cleanup) => cleanup())
    }
  }, [socket])

  return (
    <LobbyContext.Provider value={{ ...state, isLeader, dispatch }}>
      {children}
    </LobbyContext.Provider>
  )
}

export function useLobby() {
  const context = useContext(LobbyContext)
  if (!context) {
    throw new Error('useLobby must be used within LobbyProvider')
  }
  return context
}
```

### 3. Create Game Context

Create `src/context/GameContext.tsx`:
```typescript
import { createContext, useContext, useReducer, useEffect, ReactNode, Dispatch } from 'react'
import type { PlayerView, PlayerId, Card } from '@hilo/shared'
import { useSocket } from '@/hooks/useSocket'

interface GameContextState {
  gameState: PlayerView | null
  selectedCards: Card[]
  showFaceUp: boolean
  lastEvent: {
    type: 'pile_blown' | 'player_won' | 'turn_change' | null
    data: any
  }
}

type GameAction =
  | { type: 'SET_GAME_STATE'; payload: PlayerView }
  | { type: 'CLEAR_GAME_STATE' }
  | { type: 'TOGGLE_CARD_SELECTION'; payload: Card }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'TOGGLE_FACE_UP' }
  | { type: 'SET_SHOW_FACE_UP'; payload: boolean }
  | { type: 'TURN_CHANGED'; payload: { activePlayerId: PlayerId } }
  | { type: 'PILE_BLOWN'; payload: { playerId: PlayerId; reason: 'ten' | 'four_of_kind' } }
  | { type: 'PLAYER_WON'; payload: { winnerId: PlayerId; winnerName: string } }
  | { type: 'CLEAR_LAST_EVENT' }

function gameReducer(state: GameContextState, action: GameAction): GameContextState {
  switch (action.type) {
    case 'SET_GAME_STATE':
      return {
        ...state,
        gameState: action.payload,
      }
    case 'CLEAR_GAME_STATE':
      return {
        gameState: null,
        selectedCards: [],
        showFaceUp: false,
        lastEvent: { type: null, data: null },
      }
    case 'TOGGLE_CARD_SELECTION': {
      const card = action.payload
      const isSelected = state.selectedCards.some(
        (c) => c.rank === card.rank && c.suit === card.suit
      )

      if (isSelected) {
        return {
          ...state,
          selectedCards: state.selectedCards.filter(
            (c) => !(c.rank === card.rank && c.suit === card.suit)
          ),
        }
      }

      // If selecting a different rank, clear previous selection
      if (state.selectedCards.length > 0 && state.selectedCards[0].rank !== card.rank) {
        return {
          ...state,
          selectedCards: [card],
        }
      }

      return {
        ...state,
        selectedCards: [...state.selectedCards, card],
      }
    }
    case 'CLEAR_SELECTION':
      return {
        ...state,
        selectedCards: [],
      }
    case 'TOGGLE_FACE_UP':
      return {
        ...state,
        showFaceUp: !state.showFaceUp,
      }
    case 'SET_SHOW_FACE_UP':
      return {
        ...state,
        showFaceUp: action.payload,
      }
    case 'TURN_CHANGED':
      return {
        ...state,
        lastEvent: { type: 'turn_change', data: action.payload },
      }
    case 'PILE_BLOWN':
      return {
        ...state,
        lastEvent: { type: 'pile_blown', data: action.payload },
      }
    case 'PLAYER_WON':
      return {
        ...state,
        lastEvent: { type: 'player_won', data: action.payload },
      }
    case 'CLEAR_LAST_EVENT':
      return {
        ...state,
        lastEvent: { type: null, data: null },
      }
    default:
      return state
  }
}

interface GameContextValue extends GameContextState {
  dispatch: Dispatch<GameAction>
  isMyTurn: boolean
}

const GameContext = createContext<GameContextValue | undefined>(undefined)

export function GameProvider({ children }: { children: ReactNode }) {
  const socket = useSocket()

  const [state, dispatch] = useReducer(gameReducer, {
    gameState: null,
    selectedCards: [],
    showFaceUp: false,
    lastEvent: { type: null, data: null },
  })

  // Set up WebSocket listeners
  useEffect(() => {
    const cleanupFns: Array<() => void> = []

    cleanupFns.push(
      socket.onGameStateUpdate((data) => {
        dispatch({ type: 'SET_GAME_STATE', payload: data.gameState })
      })
    )

    cleanupFns.push(
      socket.onGameTurnChange((data) => {
        dispatch({ type: 'TURN_CHANGED', payload: data })
      })
    )

    cleanupFns.push(
      socket.onGamePileBlown((data) => {
        dispatch({ type: 'PILE_BLOWN', payload: data })
      })
    )

    cleanupFns.push(
      socket.onGamePlayerWon((data) => {
        dispatch({ type: 'PLAYER_WON', payload: data })
      })
    )

    return () => {
      cleanupFns.forEach((cleanup) => cleanup())
    }
  }, [socket])

  // Compute isMyTurn (you would need playerId from PlayerContext)
  const isMyTurn = false // TODO: Compare with playerId

  return (
    <GameContext.Provider value={{ ...state, dispatch, isMyTurn }}>
      {children}
    </GameContext.Provider>
  )
}

export function useGame() {
  const context = useContext(GameContext)
  if (!context) {
    throw new Error('useGame must be used within GameProvider')
  }
  return context
}
```

### 4. Create UI State Context (Toasts, Modals)

Create `src/context/UIContext.tsx`:
```typescript
import { createContext, useContext, useState, ReactNode, useCallback } from 'react'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
  duration?: number
}

interface UIContextValue {
  toasts: Toast[]
  showToast: (message: string, type: Toast['type'], duration?: number) => void
  removeToast: (id: string) => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
}

const UIContext = createContext<UIContextValue | undefined>(undefined)

export function UIProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const showToast = useCallback((message: string, type: Toast['type'], duration = 3000) => {
    const id = Math.random().toString(36).substr(2, 9)
    const toast: Toast = { id, message, type, duration }

    setToasts((prev) => [...prev, toast])

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  return (
    <UIContext.Provider
      value={{
        toasts,
        showToast,
        removeToast,
        isLoading,
        setIsLoading,
      }}
    >
      {children}
    </UIContext.Provider>
  )
}

export function useUI() {
  const context = useContext(UIContext)
  if (!context) {
    throw new Error('useUI must be used within UIProvider')
  }
  return context
}
```

### 5. Create Root Provider

Create `src/context/index.tsx`:
```typescript
import { ReactNode } from 'react'
import { PlayerProvider } from './PlayerContext'
import { LobbyProvider } from './LobbyContext'
import { GameProvider } from './GameContext'
import { UIProvider } from './UIContext'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <PlayerProvider>
      <UIProvider>
        <LobbyProvider>
          <GameProvider>
            {children}
          </GameProvider>
        </LobbyProvider>
      </UIProvider>
    </PlayerProvider>
  )
}

// Re-export hooks
export { usePlayer } from './PlayerContext'
export { useLobby } from './LobbyContext'
export { useGame } from './GameContext'
export { useUI } from './UIContext'
```

### 6. Update Main App

Update `src/main.tsx`:
```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { AppProviders } from './context'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>,
)
```

## State Flow Diagrams

### Lobby State Flow
```
User Action (Create/Join Lobby)
    |
    v
HTTP API Call → Set Initial Lobby State
    |
    v
WebSocket Join Room
    |
    v
WebSocket Events → Update Lobby State
    (playerJoined, playerLeft, playerReadied, leaderChanged)
```

### Game State Flow
```
Leader Starts Game
    |
    v
HTTP API Call → Receive Initial PlayerView
    |
    v
Set Game State
    |
    v
WebSocket Events → Update Game State
    (stateUpdate, turnChange, pileBlown, playerWon)
    |
    v
Player Action (Play Cards, Select Face-up, etc.)
    |
    v
HTTP API Call → Server validates and updates
    |
    v
WebSocket Broadcast → All players receive updated state
```

## Testing

Create `src/context/__tests__/PlayerContext.test.tsx`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { PlayerProvider, usePlayer } from '../PlayerContext'
import { clearPlayerData } from '@/utils/player'

describe('PlayerContext', () => {
  beforeEach(() => {
    clearPlayerData()
    localStorage.clear()
  })

  it('generates and stores player ID', () => {
    const { result } = renderHook(() => usePlayer(), {
      wrapper: PlayerProvider,
    })

    expect(result.current.playerId).toBeTruthy()
    expect(result.current.playerId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })

  it('persists player name to localStorage', () => {
    const { result } = renderHook(() => usePlayer(), {
      wrapper: PlayerProvider,
    })

    act(() => {
      result.current.setPlayerName('TestPlayer')
    })

    expect(result.current.playerName).toBe('TestPlayer')
    expect(localStorage.getItem('hilo:playerName')).toBe('TestPlayer')
  })
})
```

## Output Files

- `/frontend/src/context/PlayerContext.tsx` - Player state management
- `/frontend/src/context/LobbyContext.tsx` - Lobby state management
- `/frontend/src/context/GameContext.tsx` - Game state management
- `/frontend/src/context/UIContext.tsx` - UI state management (toasts, loading)
- `/frontend/src/context/index.tsx` - Root provider and re-exports

## Next Steps

- Task 5: Use PlayerContext and LobbyContext in Landing Page
- Task 6: Use LobbyContext in Lobby Page
- Task 7: Use GameContext in Game Page
- Task 8: Create Toast component for UIContext

## Notes

- Context API with useReducer provides sufficient state management for this app
- WebSocket events automatically update context state
- No need for Redux unless app complexity increases significantly
- All contexts are typed with TypeScript for type safety
