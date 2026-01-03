import { createContext, useContext, useReducer, useEffect } from 'react'
import type { ReactNode, Dispatch } from 'react'
import type { LobbyState, PlayerId, Player } from '@hilo/shared'
import { socketManager } from '@/services/socket'

interface LobbyContextState {
  lobby: LobbyState | null
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
  isLeader: (playerId: string) => boolean
}

const LobbyContext = createContext<LobbyContextValue | undefined>(undefined)

export function LobbyProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(lobbyReducer, {
    lobby: null,
    connectedToLobby: false,
  })

  // Set up WebSocket listeners BEFORE connecting
  // This ensures listeners are ready when socket connects and events are fired
  useEffect(() => {
    const cleanupFns: Array<() => void> = []

    // Register all listeners first - these will be queued until socket connects
    cleanupFns.push(
      socketManager.onLobbyPlayerJoined((data) => {
        dispatch({ type: 'PLAYER_JOINED', payload: data })
      })
    )

    cleanupFns.push(
      socketManager.onLobbyPlayerLeft((data) => {
        dispatch({ type: 'PLAYER_LEFT', payload: data })
      })
    )

    cleanupFns.push(
      socketManager.onLobbyPlayerReadied((data) => {
        dispatch({ type: 'PLAYER_READIED', payload: data })
      })
    )

    cleanupFns.push(
      socketManager.onLobbyLeaderChanged((data) => {
        dispatch({ type: 'LEADER_CHANGED', payload: data })
      })
    )

    // Now connect the socket - listeners are registered and ready
    socketManager.connect()

    return () => {
      cleanupFns.forEach((cleanup) => cleanup())
    }
  }, [])

  const isLeader = (playerId: string) => state.lobby?.leaderId === playerId

  return (
    <LobbyContext.Provider value={{ ...state, dispatch, isLeader }}>
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
