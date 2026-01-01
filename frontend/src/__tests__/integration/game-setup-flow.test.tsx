import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom'
import { GamePage } from '@/pages/GamePage'
import { AppProviders } from '@/context'
import { apiClient } from '@/services/api'
import { socketManager } from '@/services/socket'
import type { PlayerView } from '@hilo/shared'

// Mock API and Socket
vi.mock('@/services/api')
vi.mock('@/services/socket')

describe('Game Setup Flow Integration', () => {
  let gameStateUpdateCallback: ((data: { gameState: PlayerView }) => void) | null = null

  const mockGameState: PlayerView = {
    id: 'game-123',
    phase: 'setup',
    myHand: [
      { rank: '2', suit: 'hearts' },
      { rank: '5', suit: 'diamonds' },
      { rank: 'A', suit: 'spades' },
      { rank: '7', suit: 'clubs' },
      { rank: 'K', suit: 'hearts' },
      { rank: '9', suit: 'diamonds' },
    ],
    myFaceUp: [],
    myFaceDownCount: 3,
    myFaceDownPlayed: [false, false, false],
    otherPlayers: {
      'player-2': {
        name: 'Player 2',
        handCount: 6,
        faceUp: [],
        faceDownCount: 3,
      },
    },
    pile: [],
    deckCount: 40,
    activePlayerId: 'player-1',
    playableCards: undefined,
    playerNames: {
      'player-1': 'Player 1',
      'player-2': 'Player 2',
    },
    turnOrder: ['player-1', 'player-2'],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    gameStateUpdateCallback = null

    // Mock socketManager
    vi.mocked(socketManager.connect).mockReturnValue(undefined as any)
    vi.mocked(socketManager.joinLobby).mockReturnValue(undefined)
    vi.mocked(socketManager.isConnected).mockReturnValue(true)

    // Capture WebSocket event callbacks
    vi.mocked(socketManager.onGameStateUpdate).mockImplementation((callback) => {
      gameStateUpdateCallback = callback
      return () => {}
    })

    vi.mocked(socketManager.onLobbyGameStarting).mockReturnValue(() => {})

    vi.mocked(socketManager.onGameTurnChange).mockReturnValue(() => {})
    vi.mocked(socketManager.onGamePlayerWon).mockReturnValue(() => {})
    vi.mocked(socketManager.onLobbyPlayerJoined).mockReturnValue(() => {})
    vi.mocked(socketManager.onLobbyPlayerReadied).mockReturnValue(() => {})
    vi.mocked(socketManager.onLobbyPlayerLeft).mockReturnValue(() => {})
    vi.mocked(socketManager.onLobbyLeaderChanged).mockReturnValue(() => {})
    vi.mocked(socketManager.onError).mockReturnValue(() => {})
  })

  it('should handle game start for leader (player 1)', async () => {
    // Mock API responses for leader
    vi.mocked(apiClient.startGame).mockResolvedValue({
      gameState: mockGameState,
    })

    // Render game page directly (simulating navigation after startGame)
    render(
      <MemoryRouter initialEntries={['/game?id=game-123']}>
        <AppProviders>
          <Routes>
            <Route path="/game" element={<GamePage />} />
          </Routes>
        </AppProviders>
      </MemoryRouter>
    )

    // Trigger game state update via WebSocket (simulating what backend sends)
    if (gameStateUpdateCallback) {
      gameStateUpdateCallback({ gameState: mockGameState })
    }

    // Leader should see the setup phase
    await waitFor(() => {
      expect(screen.getByText(/Setup Phase/i)).toBeInTheDocument()
    })

    // Should see "Select any 3 cards for your face-up pile"
    expect(screen.getByText(/Select any 3 cards/i)).toBeInTheDocument()
  })

  it('should handle game start for non-leader (player 2) - REPRODUCES BUG', async () => {
    // Mock game state for player 2's perspective
    const player2GameState: PlayerView = {
      ...mockGameState,
      activePlayerId: 'player-1', // Player 1 goes first
      myHand: [
        { rank: '3', suit: 'clubs' },
        { rank: '6', suit: 'spades' },
        { rank: 'Q', suit: 'hearts' },
        { rank: '8', suit: 'diamonds' },
        { rank: 'J', suit: 'clubs' },
        { rank: '4', suit: 'spades' },
      ],
      otherPlayers: {
        'player-1': {
          name: 'Player 1',
          handCount: 6,
          faceUp: [],
          faceDownCount: 3,
        },
      },
    }

    // Render game page as non-leader player
    render(
      <MemoryRouter initialEntries={['/game?id=game-123']}>
        <AppProviders>
          <Routes>
            <Route path="/game" element={<GamePage />} />
          </Routes>
        </AppProviders>
      </MemoryRouter>
    )

    // BUG: Non-leader navigates to game page but doesn't receive game state
    // They should see "Loading game..." indefinitely

    // Initially shows loading
    expect(screen.getByText(/Loading game/i)).toBeInTheDocument()

    // Wait a bit to confirm it's stuck
    await new Promise(resolve => setTimeout(resolve, 100))

    // Still loading - THIS IS THE BUG
    expect(screen.getByText(/Loading game/i)).toBeInTheDocument()

    // FIX: When game state is sent via WebSocket, player should see waiting screen
    if (gameStateUpdateCallback) {
      gameStateUpdateCallback({ gameState: player2GameState })
    }

    // After receiving game state, should show waiting screen (not their turn yet)
    await waitFor(() => {
      expect(screen.queryByText(/Loading game/i)).not.toBeInTheDocument()
    })

    expect(screen.getByText(/Setup Phase/i)).toBeInTheDocument()
    expect(screen.getByText(/Waiting for other players/i)).toBeInTheDocument()
  })

  it('should transition player 2 to their turn after player 1 selects cards', async () => {
    // Start with player 2 waiting
    const player2WaitingState: PlayerView = {
      ...mockGameState,
      activePlayerId: 'player-1',
      myHand: [
        { rank: '3', suit: 'clubs' },
        { rank: '6', suit: 'spades' },
        { rank: 'Q', suit: 'hearts' },
        { rank: '8', suit: 'diamonds' },
        { rank: 'J', suit: 'clubs' },
        { rank: '4', suit: 'spades' },
      ],
      otherPlayers: {
        'player-1': {
          name: 'Player 1',
          handCount: 3,
          faceUp: [
            { rank: '2', suit: 'hearts' },
            { rank: '5', suit: 'diamonds' },
            { rank: 'A', suit: 'spades' },
          ],
          faceDownCount: 3,
        },
      },
    }

    render(
      <MemoryRouter initialEntries={['/game?id=game-123']}>
        <AppProviders>
          <Routes>
            <Route path="/game" element={<GamePage />} />
          </Routes>
        </AppProviders>
      </MemoryRouter>
    )

    // Send initial game state
    if (gameStateUpdateCallback) {
      gameStateUpdateCallback({ gameState: player2WaitingState })
    }

    // Player 2 should see waiting screen
    await waitFor(() => {
      expect(screen.getByText(/Waiting for other players/i)).toBeInTheDocument()
    })

    // Player 1 finishes selecting, now it's player 2's turn
    const player2ActiveState: PlayerView = {
      ...player2WaitingState,
      activePlayerId: 'player-2',
    }

    if (gameStateUpdateCallback) {
      gameStateUpdateCallback({ gameState: player2ActiveState })
    }

    // Player 2 should now see the setup screen
    await waitFor(() => {
      expect(screen.queryByText(/Waiting for other players/i)).not.toBeInTheDocument()
    })

    expect(screen.getByText(/Setup Phase/i)).toBeInTheDocument()
    expect(screen.getByText(/Select 3 cards for your face-up pile/i)).toBeInTheDocument()
  })
})
