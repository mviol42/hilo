import { createContext, useContext, useReducer, useEffect } from 'react'
import type { ReactNode, Dispatch } from 'react'
import { type PlayerView, type PlayerId, type Card, cardsEqual } from '@hilo/shared'
import { socketManager } from '@/services/socket'

interface GameContextState {
  gameState: PlayerView | null
  selectedCards: Card[]
  showFaceUp: boolean
  lastEvent: {
    type: 'pile_blown' | 'player_won' | 'turn_change' | null
    data: any
  }
  lastPlayedCards: {
    cards: Card[]
    playerName: string
  } | null
  pileBlownInfo: {
    playerId: PlayerId
    reason: 'ten' | 'four_of_kind'
  } | null
  pilePickupInfo: {
    playerId: PlayerId
    playerName: string
    cardCount: number
    cards?: Card[]
  } | null
  /** Tracks the last processed stateVersion for idempotent updates */
  lastStateVersion: number
}

type GameAction =
  | { type: 'SET_GAME_STATE'; payload: PlayerView }
  | { type: 'CLEAR_GAME_STATE' }
  | { type: 'TOGGLE_CARD_SELECTION'; payload: Card }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'TOGGLE_FACE_UP' }
  | { type: 'SET_SHOW_FACE_UP'; payload: boolean }
  | { type: 'TURN_CHANGED'; payload: { activePlayerId: PlayerId } }
  | { type: 'PLAYER_WON'; payload: { winnerId: PlayerId; winnerName: string } }
  | { type: 'CLEAR_LAST_EVENT' }
  | { type: 'CLEAR_LAST_PLAYED' }
  | { type: 'CLEAR_PILE_BLOWN' }
  | { type: 'CLEAR_PILE_PICKUP' }

function gameReducer(state: GameContextState, action: GameAction): GameContextState {
  switch (action.type) {
    case 'SET_GAME_STATE': {
      const newState = action.payload

      // Idempotent state update: skip if we've already processed this or a newer version
      // This prevents duplicate processing from heartbeats or retried updates
      if (newState.stateVersion <= state.lastStateVersion) {
        console.log('[GameContext] Skipping stale state update:', {
          received: newState.stateVersion,
          current: state.lastStateVersion,
        })
        return state
      }

      let lastPlayedCards: GameContextState['lastPlayedCards'] = null
      let pileBlownInfo: GameContextState['pileBlownInfo'] = null
      let pilePickupInfo: GameContextState['pilePickupInfo'] = null

      // Read action info from server-provided lastAction
      if (newState.lastAction) {
        const { type, playerId, playerName, cards, blowUpReason, pickedUpCount } = newState.lastAction
        console.log('[GameContext] lastAction received:', { type, playerName, cards, blowUpReason, pickedUpCount })

        // Set lastPlayedCards for play_cards or blow_up actions (actions with cards)
        if ((type === 'play_cards' || type === 'blow_up') && cards && cards.length > 0) {
          lastPlayedCards = { cards, playerName }
        }

        // Set pileBlownInfo if this was a blow-up
        if (type === 'blow_up' && blowUpReason) {
          pileBlownInfo = { playerId, reason: blowUpReason }
        }

        // Set pilePickupInfo if this was a pickup
        if (type === 'pickup_pile' && pickedUpCount !== undefined) {
          pilePickupInfo = { playerId, playerName, cardCount: pickedUpCount, cards }
        }
      } else {
        console.log('[GameContext] No lastAction in state update')
      }

      console.log('[GameContext] Applying state update:', {
        version: newState.stateVersion,
        phase: newState.phase,
      })

      return {
        ...state,
        gameState: newState,
        lastPlayedCards,
        pileBlownInfo,
        pilePickupInfo,
        lastStateVersion: newState.stateVersion,
      }
    }
    case 'CLEAR_GAME_STATE':
      return {
        gameState: null,
        selectedCards: [],
        showFaceUp: false,
        lastEvent: { type: null, data: null },
        lastPlayedCards: null,
        pileBlownInfo: null,
        pilePickupInfo: null,
        lastStateVersion: -1, // Reset to allow any new game state
      }
    case 'TOGGLE_CARD_SELECTION': {
      const card = action.payload
      const isSelected = state.selectedCards.some(c => cardsEqual(c, card))

      if (isSelected) {
        return {
          ...state,
          selectedCards: state.selectedCards.filter(c => !cardsEqual(c, card)),
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
    case 'CLEAR_LAST_PLAYED':
      return {
        ...state,
        lastPlayedCards: null,
      }
    case 'CLEAR_PILE_BLOWN':
      return {
        ...state,
        pileBlownInfo: null,
      }
    case 'CLEAR_PILE_PICKUP':
      return {
        ...state,
        pilePickupInfo: null,
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
    lastPlayedCards: null,
    pileBlownInfo: null,
    pilePickupInfo: null,
    lastStateVersion: -1, // Start at -1 to accept any initial state (version 0+)
  })

  // Register WebSocket listeners
  // Note: Socket connection is coordinated by AppProviders to ensure
  // all contexts (Lobby, Game, etc.) register listeners before connecting
  useEffect(() => {
    console.log('[GameContext] Registering game event listeners')
    const cleanupFns: Array<() => void> = []

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

    // Note: pileBlown info is now read from lastAction in game:stateUpdate

    cleanupFns.push(
      socketManager.onGamePlayerWon((data) => {
        console.log('[GameContext] Player won:', data.winnerId)
        dispatch({ type: 'PLAYER_WON', payload: data })
      })
    )

    return () => {
      console.log('[GameContext] Cleaning up game event listeners')
      cleanupFns.forEach((cleanup) => cleanup())
    }
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
