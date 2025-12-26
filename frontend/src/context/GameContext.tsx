import { createContext, useContext, useReducer, useEffect } from 'react'
import type { ReactNode, Dispatch } from 'react'
import type { PlayerView, PlayerId, Card } from '@hilo/shared'
import { socketManager } from '@/services/socket'

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
}

const GameContext = createContext<GameContextValue | undefined>(undefined)

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, {
    gameState: null,
    selectedCards: [],
    showFaceUp: false,
    lastEvent: { type: null, data: null },
  })

  // Set up WebSocket listeners
  useEffect(() => {
    // Wait for socket to be connected before setting up listeners
    const setupListeners = () => {
      if (!socketManager.isConnected()) {
        console.log('[GameContext] Socket not connected, waiting...')
        // Retry after a short delay
        const timeout = setTimeout(setupListeners, 100)
        return () => clearTimeout(timeout)
      }

      const cleanupFns: Array<() => void> = []

      try {
        console.log('[GameContext] Setting up game event listeners')

        cleanupFns.push(
          socketManager.onGameStateUpdate((data) => {
            console.log('[GameContext] Received game state update:', data.gameState.phase)
            dispatch({ type: 'SET_GAME_STATE', payload: data.gameState })
          })
        )

        cleanupFns.push(
          socketManager.onGameTurnChange((data) => {
            console.log('[GameContext] Turn changed to:', data.activePlayerId)
            dispatch({ type: 'TURN_CHANGED', payload: data })
          })
        )

        cleanupFns.push(
          socketManager.onGamePileBlown((data) => {
            console.log('[GameContext] Pile blown:', data.reason)
            dispatch({ type: 'PILE_BLOWN', payload: data })
          })
        )

        cleanupFns.push(
          socketManager.onGamePlayerWon((data) => {
            console.log('[GameContext] Player won:', data.winnerId)
            dispatch({ type: 'PLAYER_WON', payload: data })
          })
        )
      } catch (error) {
        console.error('Failed to set up game event listeners:', error)
      }

      return () => {
        console.log('[GameContext] Cleaning up game event listeners')
        cleanupFns.forEach((cleanup) => cleanup())
      }
    }

    return setupListeners()
  }, [])

  return (
    <GameContext.Provider value={{ ...state, dispatch }}>
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
