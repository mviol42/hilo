import { render, screen, renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom'
import { GameProvider, useGame } from './GameContext'
import type { PlayerView, LastAction } from '@hilo/shared'

// Mock the socket manager to prevent WebSocket setup
vi.mock('@/services/socket', () => ({
  socketManager: {
    isConnected: () => false,
    onGameStateUpdate: vi.fn(() => () => {}),
    onGameTurnChange: vi.fn(() => () => {}),
    onGamePlayerWon: vi.fn(() => () => {}),
  },
}))

describe('GameContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function TestComponent() {
    const { gameState, lastPlayedCards, pileBlownInfo, dispatch } = useGame()
    return (
      <div>
        <p data-testid="game-phase">{gameState?.phase || 'no game'}</p>
        <p data-testid="last-played-cards">
          {lastPlayedCards ? JSON.stringify(lastPlayedCards) : 'none'}
        </p>
        <p data-testid="pile-blown-info">
          {pileBlownInfo ? JSON.stringify(pileBlownInfo) : 'none'}
        </p>
        <button
          data-testid="dispatch-button"
          onClick={() => {}}
        >
          Dispatch
        </button>
      </div>
    )
  }

  it('throws error when useGame is used outside provider', () => {
    const originalError = console.error
    console.error = vi.fn()

    expect(() => {
      renderHook(() => useGame())
    }).toThrow('useGame must be used within GameProvider')

    console.error = originalError
  })

  it('initializes with null game state', () => {
    render(
      <GameProvider>
        <TestComponent />
      </GameProvider>
    )

    expect(screen.getByTestId('game-phase')).toHaveTextContent('no game')
    expect(screen.getByTestId('last-played-cards')).toHaveTextContent('none')
    expect(screen.getByTestId('pile-blown-info')).toHaveTextContent('none')
  })

  describe('SET_GAME_STATE with lastAction', () => {
    function DispatchableComponent({
      onMount,
    }: {
      onMount: (dispatch: ReturnType<typeof useGame>['dispatch']) => void
    }) {
      const { gameState, lastPlayedCards, pileBlownInfo, dispatch } = useGame()

      // Call onMount once with dispatch
      React.useEffect(() => {
        onMount(dispatch)
      }, [])

      return (
        <div>
          <p data-testid="game-phase">{gameState?.phase || 'no game'}</p>
          <p data-testid="last-played-cards">
            {lastPlayedCards ? JSON.stringify(lastPlayedCards) : 'none'}
          </p>
          <p data-testid="pile-blown-info">
            {pileBlownInfo ? JSON.stringify(pileBlownInfo) : 'none'}
          </p>
        </div>
      )
    }

    it('extracts lastPlayedCards from play_cards lastAction', () => {
      let dispatchRef: ReturnType<typeof useGame>['dispatch']

      const playerView: PlayerView = {
        id: 'game-1',
        phase: 'playing',
        myHand: [],
        myFaceUp: [],
        myFaceDownCount: 0,
        myFaceDownPlayed: [],
        otherPlayers: {},
        pile: [],
        deckCount: 40,
        activePlayerId: 'player-2',
        playerNames: { 'player-1': 'Alice', 'player-2': 'Bob' },
        lastAction: {
          type: 'play_cards',
          playerId: 'player-1',
          playerName: 'Alice',
          cards: [{ rank: '5', suit: 'hearts' }, { rank: '5', suit: 'diamonds' }],
          timestamp: new Date().toISOString(),
        },
      }

      render(
        <GameProvider>
          <DispatchableComponent
            onMount={(dispatch) => {
              dispatchRef = dispatch
            }}
          />
        </GameProvider>
      )

      act(() => {
        dispatchRef({ type: 'SET_GAME_STATE', payload: playerView })
      })

      expect(screen.getByTestId('game-phase')).toHaveTextContent('playing')

      const lastPlayedText = screen.getByTestId('last-played-cards').textContent
      expect(lastPlayedText).not.toBe('none')

      const lastPlayed = JSON.parse(lastPlayedText!)
      expect(lastPlayed.playerName).toBe('Alice')
      expect(lastPlayed.cards).toHaveLength(2)
      expect(lastPlayed.cards[0].rank).toBe('5')
    })

    it('extracts lastPlayedCards and pileBlownInfo from blow_up lastAction', () => {
      let dispatchRef: ReturnType<typeof useGame>['dispatch']

      const playerView: PlayerView = {
        id: 'game-1',
        phase: 'playing',
        myHand: [],
        myFaceUp: [],
        myFaceDownCount: 0,
        myFaceDownPlayed: [],
        otherPlayers: {},
        pile: [],
        deckCount: 40,
        activePlayerId: 'player-1',
        playerNames: { 'player-1': 'Alice', 'player-2': 'Bob' },
        lastAction: {
          type: 'blow_up',
          playerId: 'player-1',
          playerName: 'Alice',
          cards: [{ rank: '10', suit: 'spades' }],
          blowUpReason: 'ten',
          timestamp: new Date().toISOString(),
        },
      }

      render(
        <GameProvider>
          <DispatchableComponent
            onMount={(dispatch) => {
              dispatchRef = dispatch
            }}
          />
        </GameProvider>
      )

      act(() => {
        dispatchRef({ type: 'SET_GAME_STATE', payload: playerView })
      })

      const lastPlayedText = screen.getByTestId('last-played-cards').textContent
      expect(lastPlayedText).not.toBe('none')

      const lastPlayed = JSON.parse(lastPlayedText!)
      expect(lastPlayed.playerName).toBe('Alice')
      expect(lastPlayed.cards[0].rank).toBe('10')

      const pileBlownText = screen.getByTestId('pile-blown-info').textContent
      expect(pileBlownText).not.toBe('none')

      const pileBlown = JSON.parse(pileBlownText!)
      expect(pileBlown.playerId).toBe('player-1')
      expect(pileBlown.reason).toBe('ten')
    })

    it('extracts pileBlownInfo for four_of_kind blow_up', () => {
      let dispatchRef: ReturnType<typeof useGame>['dispatch']

      const playerView: PlayerView = {
        id: 'game-1',
        phase: 'playing',
        myHand: [],
        myFaceUp: [],
        myFaceDownCount: 0,
        myFaceDownPlayed: [],
        otherPlayers: {},
        pile: [],
        deckCount: 40,
        activePlayerId: 'player-1',
        playerNames: { 'player-1': 'Alice' },
        lastAction: {
          type: 'blow_up',
          playerId: 'player-1',
          playerName: 'Alice',
          cards: [{ rank: '7', suit: 'clubs' }],
          blowUpReason: 'four_of_kind',
          timestamp: new Date().toISOString(),
        },
      }

      render(
        <GameProvider>
          <DispatchableComponent
            onMount={(dispatch) => {
              dispatchRef = dispatch
            }}
          />
        </GameProvider>
      )

      act(() => {
        dispatchRef({ type: 'SET_GAME_STATE', payload: playerView })
      })

      const pileBlownText = screen.getByTestId('pile-blown-info').textContent
      const pileBlown = JSON.parse(pileBlownText!)
      expect(pileBlown.reason).toBe('four_of_kind')
    })

    it('does not set lastPlayedCards for pickup_pile action', () => {
      let dispatchRef: ReturnType<typeof useGame>['dispatch']

      const playerView: PlayerView = {
        id: 'game-1',
        phase: 'playing',
        myHand: [],
        myFaceUp: [],
        myFaceDownCount: 0,
        myFaceDownPlayed: [],
        otherPlayers: {},
        pile: [],
        deckCount: 40,
        activePlayerId: 'player-2',
        playerNames: { 'player-1': 'Alice', 'player-2': 'Bob' },
        lastAction: {
          type: 'pickup_pile',
          playerId: 'player-1',
          playerName: 'Alice',
          pickedUpCount: 5,
          timestamp: new Date().toISOString(),
        },
      }

      render(
        <GameProvider>
          <DispatchableComponent
            onMount={(dispatch) => {
              dispatchRef = dispatch
            }}
          />
        </GameProvider>
      )

      act(() => {
        dispatchRef({ type: 'SET_GAME_STATE', payload: playerView })
      })

      // pickup_pile should NOT set lastPlayedCards (no cards to display)
      expect(screen.getByTestId('last-played-cards')).toHaveTextContent('none')
    })

    it('does not set lastPlayedCards when lastAction has empty cards array', () => {
      let dispatchRef: ReturnType<typeof useGame>['dispatch']

      const playerView: PlayerView = {
        id: 'game-1',
        phase: 'playing',
        myHand: [],
        myFaceUp: [],
        myFaceDownCount: 0,
        myFaceDownPlayed: [],
        otherPlayers: {},
        pile: [],
        deckCount: 40,
        activePlayerId: 'player-2',
        playerNames: { 'player-1': 'Alice' },
        lastAction: {
          type: 'play_cards',
          playerId: 'player-1',
          playerName: 'Alice',
          cards: [], // Empty cards array
          timestamp: new Date().toISOString(),
        },
      }

      render(
        <GameProvider>
          <DispatchableComponent
            onMount={(dispatch) => {
              dispatchRef = dispatch
            }}
          />
        </GameProvider>
      )

      act(() => {
        dispatchRef({ type: 'SET_GAME_STATE', payload: playerView })
      })

      // Empty cards should NOT set lastPlayedCards
      expect(screen.getByTestId('last-played-cards')).toHaveTextContent('none')
    })

    it('does not set lastPlayedCards when lastAction is undefined', () => {
      let dispatchRef: ReturnType<typeof useGame>['dispatch']

      const playerView: PlayerView = {
        id: 'game-1',
        phase: 'playing',
        myHand: [],
        myFaceUp: [],
        myFaceDownCount: 0,
        myFaceDownPlayed: [],
        otherPlayers: {},
        pile: [],
        deckCount: 40,
        activePlayerId: 'player-2',
        playerNames: { 'player-1': 'Alice' },
        // No lastAction
      }

      render(
        <GameProvider>
          <DispatchableComponent
            onMount={(dispatch) => {
              dispatchRef = dispatch
            }}
          />
        </GameProvider>
      )

      act(() => {
        dispatchRef({ type: 'SET_GAME_STATE', payload: playerView })
      })

      expect(screen.getByTestId('last-played-cards')).toHaveTextContent('none')
    })
  })

  describe('CLEAR actions', () => {
    function DispatchableComponent({
      onMount,
    }: {
      onMount: (dispatch: ReturnType<typeof useGame>['dispatch']) => void
    }) {
      const { gameState, lastPlayedCards, pileBlownInfo, dispatch } = useGame()

      React.useEffect(() => {
        onMount(dispatch)
      }, [])

      return (
        <div>
          <p data-testid="last-played-cards">
            {lastPlayedCards ? JSON.stringify(lastPlayedCards) : 'none'}
          </p>
          <p data-testid="pile-blown-info">
            {pileBlownInfo ? JSON.stringify(pileBlownInfo) : 'none'}
          </p>
        </div>
      )
    }

    it('CLEAR_LAST_PLAYED clears lastPlayedCards', () => {
      let dispatchRef: ReturnType<typeof useGame>['dispatch']

      const playerView: PlayerView = {
        id: 'game-1',
        phase: 'playing',
        myHand: [],
        myFaceUp: [],
        myFaceDownCount: 0,
        myFaceDownPlayed: [],
        otherPlayers: {},
        pile: [],
        deckCount: 40,
        activePlayerId: 'player-2',
        playerNames: { 'player-1': 'Alice' },
        lastAction: {
          type: 'play_cards',
          playerId: 'player-1',
          playerName: 'Alice',
          cards: [{ rank: '5', suit: 'hearts' }],
          timestamp: new Date().toISOString(),
        },
      }

      render(
        <GameProvider>
          <DispatchableComponent
            onMount={(dispatch) => {
              dispatchRef = dispatch
            }}
          />
        </GameProvider>
      )

      // First set the game state with lastAction
      act(() => {
        dispatchRef({ type: 'SET_GAME_STATE', payload: playerView })
      })

      expect(screen.getByTestId('last-played-cards').textContent).not.toBe('none')

      // Then clear it
      act(() => {
        dispatchRef({ type: 'CLEAR_LAST_PLAYED' })
      })

      expect(screen.getByTestId('last-played-cards')).toHaveTextContent('none')
    })

    it('CLEAR_PILE_BLOWN clears pileBlownInfo', () => {
      let dispatchRef: ReturnType<typeof useGame>['dispatch']

      const playerView: PlayerView = {
        id: 'game-1',
        phase: 'playing',
        myHand: [],
        myFaceUp: [],
        myFaceDownCount: 0,
        myFaceDownPlayed: [],
        otherPlayers: {},
        pile: [],
        deckCount: 40,
        activePlayerId: 'player-1',
        playerNames: { 'player-1': 'Alice' },
        lastAction: {
          type: 'blow_up',
          playerId: 'player-1',
          playerName: 'Alice',
          cards: [{ rank: '10', suit: 'spades' }],
          blowUpReason: 'ten',
          timestamp: new Date().toISOString(),
        },
      }

      render(
        <GameProvider>
          <DispatchableComponent
            onMount={(dispatch) => {
              dispatchRef = dispatch
            }}
          />
        </GameProvider>
      )

      // First set the game state with blow_up lastAction
      act(() => {
        dispatchRef({ type: 'SET_GAME_STATE', payload: playerView })
      })

      expect(screen.getByTestId('pile-blown-info').textContent).not.toBe('none')

      // Then clear it
      act(() => {
        dispatchRef({ type: 'CLEAR_PILE_BLOWN' })
      })

      expect(screen.getByTestId('pile-blown-info')).toHaveTextContent('none')
    })
  })
})

// Need React for the useEffect in test components
import React from 'react'
