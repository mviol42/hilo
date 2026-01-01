import { render, screen, renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom'
import { GameProvider, useGame } from './GameContext'
import type { PlayerView } from '@hilo/shared'

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
    const { gameState, lastPlayedCards, pileBlownInfo } = useGame()
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
        turnOrder: ['player-1', 'player-2'],
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
        turnOrder: ['player-1', 'player-2'],
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
        turnOrder: ['player-1'],
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
        turnOrder: ['player-1', 'player-2'],
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
        turnOrder: ['player-1'],
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
        turnOrder: ['player-1'],
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

  describe('3-player lastAction scenarios', () => {
    function DispatchableComponent({
      onMount,
    }: {
      onMount: (dispatch: ReturnType<typeof useGame>['dispatch']) => void
    }) {
      const { gameState, lastPlayedCards, pileBlownInfo, pilePickupInfo, dispatch } = useGame()

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
          <p data-testid="pile-pickup-info">
            {pilePickupInfo ? JSON.stringify(pilePickupInfo) : 'none'}
          </p>
        </div>
      )
    }

    it('correctly extracts player 1 name in 3-player game', () => {
      let dispatchRef: ReturnType<typeof useGame>['dispatch']

      const playerView: PlayerView = {
        id: 'game-1',
        phase: 'playing',
        myHand: [],
        myFaceUp: [],
        myFaceDownCount: 0,
        myFaceDownPlayed: [],
        otherPlayers: {
          'player-2': { name: 'Bob', handCount: 5, faceUp: [], faceDownCount: 3 },
          'player-3': { name: 'Charlie', handCount: 5, faceUp: [], faceDownCount: 3 },
        },
        pile: [{ rank: '5', suit: 'hearts' }],
        deckCount: 30,
        activePlayerId: 'player-2',
        playerNames: { 'player-1': 'Alice', 'player-2': 'Bob', 'player-3': 'Charlie' },
        turnOrder: ['player-1', 'player-2', 'player-3'],
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

      act(() => {
        dispatchRef({ type: 'SET_GAME_STATE', payload: playerView })
      })

      const lastPlayedText = screen.getByTestId('last-played-cards').textContent
      const lastPlayed = JSON.parse(lastPlayedText!)
      expect(lastPlayed.playerName).toBe('Alice')
    })

    it('correctly extracts player 2 name in 3-player game', () => {
      let dispatchRef: ReturnType<typeof useGame>['dispatch']

      const playerView: PlayerView = {
        id: 'game-1',
        phase: 'playing',
        myHand: [],
        myFaceUp: [],
        myFaceDownCount: 0,
        myFaceDownPlayed: [],
        otherPlayers: {
          'player-2': { name: 'Bob', handCount: 4, faceUp: [], faceDownCount: 3 },
          'player-3': { name: 'Charlie', handCount: 5, faceUp: [], faceDownCount: 3 },
        },
        pile: [{ rank: '5', suit: 'hearts' }, { rank: '6', suit: 'diamonds' }],
        deckCount: 29,
        activePlayerId: 'player-3',
        playerNames: { 'player-1': 'Alice', 'player-2': 'Bob', 'player-3': 'Charlie' },
        turnOrder: ['player-1', 'player-2', 'player-3'],
        lastAction: {
          type: 'play_cards',
          playerId: 'player-2',
          playerName: 'Bob',
          cards: [{ rank: '6', suit: 'diamonds' }],
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
      const lastPlayed = JSON.parse(lastPlayedText!)
      expect(lastPlayed.playerName).toBe('Bob')
    })

    it('correctly extracts player 3 name in 3-player game', () => {
      let dispatchRef: ReturnType<typeof useGame>['dispatch']

      const playerView: PlayerView = {
        id: 'game-1',
        phase: 'playing',
        myHand: [],
        myFaceUp: [],
        myFaceDownCount: 0,
        myFaceDownPlayed: [],
        otherPlayers: {
          'player-2': { name: 'Bob', handCount: 4, faceUp: [], faceDownCount: 3 },
          'player-3': { name: 'Charlie', handCount: 4, faceUp: [], faceDownCount: 3 },
        },
        pile: [{ rank: '5', suit: 'hearts' }, { rank: '6', suit: 'diamonds' }, { rank: '7', suit: 'clubs' }],
        deckCount: 28,
        activePlayerId: 'player-1',
        playerNames: { 'player-1': 'Alice', 'player-2': 'Bob', 'player-3': 'Charlie' },
        turnOrder: ['player-1', 'player-2', 'player-3'],
        lastAction: {
          type: 'play_cards',
          playerId: 'player-3',
          playerName: 'Charlie',
          cards: [{ rank: '7', suit: 'clubs' }],
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
      const lastPlayed = JSON.parse(lastPlayedText!)
      expect(lastPlayed.playerName).toBe('Charlie')
    })

    it('correctly extracts blow-up player name in 3-player game', () => {
      let dispatchRef: ReturnType<typeof useGame>['dispatch']

      const playerView: PlayerView = {
        id: 'game-1',
        phase: 'playing',
        myHand: [],
        myFaceUp: [],
        myFaceDownCount: 0,
        myFaceDownPlayed: [],
        otherPlayers: {
          'player-2': { name: 'Bob', handCount: 4, faceUp: [], faceDownCount: 3 },
          'player-3': { name: 'Charlie', handCount: 5, faceUp: [], faceDownCount: 3 },
        },
        pile: [],
        deckCount: 30,
        activePlayerId: 'player-2', // Player 2 goes again after blow-up
        playerNames: { 'player-1': 'Alice', 'player-2': 'Bob', 'player-3': 'Charlie' },
        turnOrder: ['player-1', 'player-2', 'player-3'],
        lastAction: {
          type: 'blow_up',
          playerId: 'player-2',
          playerName: 'Bob',
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
      const lastPlayed = JSON.parse(lastPlayedText!)
      expect(lastPlayed.playerName).toBe('Bob')

      const pileBlownText = screen.getByTestId('pile-blown-info').textContent
      const pileBlown = JSON.parse(pileBlownText!)
      expect(pileBlown.playerId).toBe('player-2')
      expect(pileBlown.reason).toBe('ten')
    })

    it('correctly extracts pickup player name in 3-player game', () => {
      let dispatchRef: ReturnType<typeof useGame>['dispatch']

      const playerView: PlayerView = {
        id: 'game-1',
        phase: 'playing',
        myHand: [],
        myFaceUp: [],
        myFaceDownCount: 0,
        myFaceDownPlayed: [],
        otherPlayers: {
          'player-2': { name: 'Bob', handCount: 4, faceUp: [], faceDownCount: 3 },
          'player-3': { name: 'Charlie', handCount: 8, faceUp: [], faceDownCount: 3 }, // Charlie picked up
        },
        pile: [],
        deckCount: 30,
        activePlayerId: 'player-1', // Turn moves to player 1 after pickup
        playerNames: { 'player-1': 'Alice', 'player-2': 'Bob', 'player-3': 'Charlie' },
        turnOrder: ['player-1', 'player-2', 'player-3'],
        lastAction: {
          type: 'pickup_pile',
          playerId: 'player-3',
          playerName: 'Charlie',
          pickedUpCount: 3,
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

      // pickup_pile doesn't set lastPlayedCards (no cards to display)
      expect(screen.getByTestId('last-played-cards')).toHaveTextContent('none')

      // But should set pilePickupInfo
      const pilePickupText = screen.getByTestId('pile-pickup-info').textContent
      const pilePickup = JSON.parse(pilePickupText!)
      expect(pilePickup.playerName).toBe('Charlie')
      expect(pilePickup.playerId).toBe('player-3')
      expect(pilePickup.cardCount).toBe(3)
    })

    it('updates player name when different players play sequentially', () => {
      let dispatchRef: ReturnType<typeof useGame>['dispatch']

      render(
        <GameProvider>
          <DispatchableComponent
            onMount={(dispatch) => {
              dispatchRef = dispatch
            }}
          />
        </GameProvider>
      )

      // Turn 1: Alice plays
      const turn1View: PlayerView = {
        id: 'game-1',
        phase: 'playing',
        myHand: [],
        myFaceUp: [],
        myFaceDownCount: 0,
        myFaceDownPlayed: [],
        otherPlayers: {},
        pile: [{ rank: '5', suit: 'hearts' }],
        deckCount: 30,
        activePlayerId: 'player-2',
        playerNames: { 'player-1': 'Alice', 'player-2': 'Bob', 'player-3': 'Charlie' },
        turnOrder: ['player-1', 'player-2', 'player-3'],
        lastAction: {
          type: 'play_cards',
          playerId: 'player-1',
          playerName: 'Alice',
          cards: [{ rank: '5', suit: 'hearts' }],
          timestamp: new Date().toISOString(),
        },
      }

      act(() => {
        dispatchRef({ type: 'SET_GAME_STATE', payload: turn1View })
      })

      let lastPlayedText = screen.getByTestId('last-played-cards').textContent
      let lastPlayed = JSON.parse(lastPlayedText!)
      expect(lastPlayed.playerName).toBe('Alice')

      // Turn 2: Bob plays
      const turn2View: PlayerView = {
        ...turn1View,
        pile: [{ rank: '5', suit: 'hearts' }, { rank: '6', suit: 'diamonds' }],
        activePlayerId: 'player-3',
        lastAction: {
          type: 'play_cards',
          playerId: 'player-2',
          playerName: 'Bob',
          cards: [{ rank: '6', suit: 'diamonds' }],
          timestamp: new Date().toISOString(),
        },
      }

      act(() => {
        dispatchRef({ type: 'SET_GAME_STATE', payload: turn2View })
      })

      lastPlayedText = screen.getByTestId('last-played-cards').textContent
      lastPlayed = JSON.parse(lastPlayedText!)
      expect(lastPlayed.playerName).toBe('Bob')

      // Turn 3: Charlie plays
      const turn3View: PlayerView = {
        ...turn2View,
        pile: [{ rank: '5', suit: 'hearts' }, { rank: '6', suit: 'diamonds' }, { rank: '7', suit: 'clubs' }],
        activePlayerId: 'player-1',
        lastAction: {
          type: 'play_cards',
          playerId: 'player-3',
          playerName: 'Charlie',
          cards: [{ rank: '7', suit: 'clubs' }],
          timestamp: new Date().toISOString(),
        },
      }

      act(() => {
        dispatchRef({ type: 'SET_GAME_STATE', payload: turn3View })
      })

      lastPlayedText = screen.getByTestId('last-played-cards').textContent
      lastPlayed = JSON.parse(lastPlayedText!)
      expect(lastPlayed.playerName).toBe('Charlie')
    })
  })

  describe('CLEAR actions', () => {
    function DispatchableComponent({
      onMount,
    }: {
      onMount: (dispatch: ReturnType<typeof useGame>['dispatch']) => void
    }) {
      const { lastPlayedCards, pileBlownInfo, dispatch } = useGame()

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
        turnOrder: ['player-1'],
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
        turnOrder: ['player-1'],
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
