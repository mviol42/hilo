import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom'
import { GamePage } from '@/pages/GamePage'
import { AppProviders } from '@/context'
import { socketManager } from '@/services/socket'
import { createCard, type PlayerView } from '@hilo/shared'

// Mock API and Socket
vi.mock('@/services/api')
vi.mock('@/services/socket')

describe('Game Won Screen', () => {
  let gameStateUpdateCallback: ((data: { gameState: PlayerView }) => void) | null = null

  const winningCardPhrases = [
    'The final blow:',
    'The winning card:',
    'Victory was sealed by:',
    'The card that ended it all:',
    'The knockout punch:',
    'This card sealed the deal:',
    'The finishing move:',
    'The card that made history:',
    'The game-ender:',
    'The coup de grâce:',
    'This card clinched the win:',
    'The death blow:',
    'The card that brought the house down:',
    'The nail in the coffin:',
    'The winning strike:',
    'This card closed the show:',
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    gameStateUpdateCallback = null

    // Set player ID in localStorage to match test player
    localStorage.setItem('hilo:playerId', 'player-1')

    // Mock socketManager
    vi.mocked(socketManager.connect).mockReturnValue(undefined as any)
    vi.mocked(socketManager.joinLobby).mockReturnValue(undefined)
    vi.mocked(socketManager.isConnected).mockReturnValue(true)
    vi.mocked(socketManager.setCurrentGameId).mockReturnValue(undefined)
    vi.mocked(socketManager.clearCurrentGameId).mockReturnValue(undefined)

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

  it('renders game won screen without hook errors when player wins', async () => {
    const wonGameState: PlayerView = {
      id: 'game-123',
      phase: 'ended',
      myHand: [],
      myFaceUp: [],
      myFaceDownCount: 0,
      myFaceDownPlayed: [true, true, true],
      otherPlayers: {},
      pile: [],
      deckCount: 0,
      activePlayerId: 'player-1',
      winner: 'player-1',
      winnerName: 'Player 1',
      playerNames: { 'player-1': 'Player 1' },
      turnOrder: ['player-1'],
      stateVersion: 10,
      lastAction: {
        type: 'play_cards',
        playerId: 'player-1',
        playerName: 'Player 1',
        cards: [createCard('A', 'spades')],
        timestamp: new Date().toISOString(),
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

    // Trigger game state update
    if (gameStateUpdateCallback) {
      gameStateUpdateCallback({ gameState: wonGameState })
    }

    // Should show victory message
    await waitFor(() => {
      expect(screen.getByText(/You Won!/i)).toBeInTheDocument()
    })

    // Should show the winning card (Ace of Spades)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('♠')).toBeInTheDocument()

    // Should show one of the winning card phrases
    const phraseElement = screen.getByText((content) => {
      return winningCardPhrases.some(phrase => content.includes(phrase.replace(':', '')))
    })
    expect(phraseElement).toBeInTheDocument()
  })

  it('renders game over screen when another player wins', async () => {
    const lostGameState: PlayerView = {
      id: 'game-123',
      phase: 'ended',
      myHand: [createCard('2', 'hearts')],
      myFaceUp: [],
      myFaceDownCount: 0,
      myFaceDownPlayed: [true, true, true],
      otherPlayers: {},
      pile: [],
      deckCount: 0,
      activePlayerId: 'player-2',
      winner: 'player-2',
      winnerName: 'Player 2',
      playerNames: { 'player-1': 'Player 1', 'player-2': 'Player 2' },
      turnOrder: ['player-1', 'player-2'],
      stateVersion: 10,
      lastAction: {
        type: 'play_cards',
        playerId: 'player-2',
        playerName: 'Player 2',
        cards: [createCard('K', 'hearts')],
        timestamp: new Date().toISOString(),
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

    if (gameStateUpdateCallback) {
      gameStateUpdateCallback({ gameState: lostGameState })
    }

    await waitFor(() => {
      expect(screen.getByText(/Game Over/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/Player 2 won!/i)).toBeInTheDocument()
  })

  it('does not crash when transitioning from loading to ended state (hook ordering)', async () => {
    // This test verifies that hooks are called in consistent order
    // even when transitioning between different render states

    render(
      <MemoryRouter initialEntries={['/game?id=game-123']}>
        <AppProviders>
          <Routes>
            <Route path="/game" element={<GamePage />} />
          </Routes>
        </AppProviders>
      </MemoryRouter>
    )

    // Initially shows loading
    expect(screen.getByText(/Loading game/i)).toBeInTheDocument()

    // Transition directly to ended state
    const endedState: PlayerView = {
      id: 'game-123',
      phase: 'ended',
      myHand: [],
      myFaceUp: [],
      myFaceDownCount: 0,
      myFaceDownPlayed: [true, true, true],
      otherPlayers: {},
      pile: [],
      deckCount: 0,
      activePlayerId: 'player-1',
      winner: 'player-1',
      winnerName: 'Player 1',
      playerNames: { 'player-1': 'Player 1' },
      turnOrder: ['player-1'],
      stateVersion: 10,
      lastAction: {
        type: 'play_cards',
        playerId: 'player-1',
        playerName: 'Player 1',
        cards: [createCard('10', 'diamonds')],
        timestamp: new Date().toISOString(),
      },
    }

    if (gameStateUpdateCallback) {
      gameStateUpdateCallback({ gameState: endedState })
    }

    // Should transition without crashing (no "Rendered more hooks" error)
    await waitFor(() => {
      expect(screen.queryByText(/Loading game/i)).not.toBeInTheDocument()
    })

    expect(screen.getByText(/You Won!/i)).toBeInTheDocument()
  })

  it('shows back to menu button', async () => {
    const endedState: PlayerView = {
      id: 'game-123',
      phase: 'ended',
      myHand: [],
      myFaceUp: [],
      myFaceDownCount: 0,
      myFaceDownPlayed: [true, true, true],
      otherPlayers: {},
      pile: [],
      deckCount: 0,
      activePlayerId: 'player-1',
      winner: 'player-1',
      winnerName: 'Player 1',
      playerNames: { 'player-1': 'Player 1' },
      turnOrder: ['player-1'],
      stateVersion: 10,
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

    if (gameStateUpdateCallback) {
      gameStateUpdateCallback({ gameState: endedState })
    }

    await waitFor(() => {
      expect(screen.getByText(/Back to Menu/i)).toBeInTheDocument()
    })
  })

  it('shows play again button', async () => {
    const endedState: PlayerView = {
      id: 'game-123',
      phase: 'ended',
      myHand: [],
      myFaceUp: [],
      myFaceDownCount: 0,
      myFaceDownPlayed: [true, true, true],
      otherPlayers: {},
      pile: [],
      deckCount: 0,
      activePlayerId: 'player-1',
      winner: 'player-1',
      winnerName: 'Player 1',
      playerNames: { 'player-1': 'Player 1' },
      turnOrder: ['player-1'],
      stateVersion: 10,
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

    if (gameStateUpdateCallback) {
      gameStateUpdateCallback({ gameState: endedState })
    }

    await waitFor(() => {
      expect(screen.getByText(/Play Again/i)).toBeInTheDocument()
    })
  })

  it('clears game ID when play again button is clicked', async () => {
    const { apiClient } = await import('@/services/api')

    // Mock the playAgain API call
    vi.mocked(apiClient.playAgain).mockResolvedValue({
      lobbyId: 'new-lobby-123',
    })

    const endedState: PlayerView = {
      id: 'game-123',
      phase: 'ended',
      myHand: [],
      myFaceUp: [],
      myFaceDownCount: 0,
      myFaceDownPlayed: [true, true, true],
      otherPlayers: {},
      pile: [],
      deckCount: 0,
      activePlayerId: 'player-1',
      winner: 'player-1',
      winnerName: 'Player 1',
      playerNames: { 'player-1': 'Player 1' },
      turnOrder: ['player-1'],
      stateVersion: 10,
    }

    render(
      <MemoryRouter initialEntries={['/game?id=game-123']}>
        <AppProviders>
          <Routes>
            <Route path="/game" element={<GamePage />} />
            <Route path="/join" element={<div>Join Page</div>} />
          </Routes>
        </AppProviders>
      </MemoryRouter>
    )

    if (gameStateUpdateCallback) {
      gameStateUpdateCallback({ gameState: endedState })
    }

    // Wait for and click the Play Again button
    const playAgainButton = await screen.findByText(/Play Again/i)
    expect(playAgainButton).toBeInTheDocument()

    playAgainButton.click()

    // Verify clearCurrentGameId was called
    await waitFor(() => {
      expect(socketManager.clearCurrentGameId).toHaveBeenCalled()
    })

    // Verify API was called with correct game ID
    expect(apiClient.playAgain).toHaveBeenCalledWith({ gameId: 'game-123' })
  })

  it('clears game ID when back to menu button is clicked', async () => {
    const endedState: PlayerView = {
      id: 'game-123',
      phase: 'ended',
      myHand: [],
      myFaceUp: [],
      myFaceDownCount: 0,
      myFaceDownPlayed: [true, true, true],
      otherPlayers: {},
      pile: [],
      deckCount: 0,
      activePlayerId: 'player-1',
      winner: 'player-1',
      winnerName: 'Player 1',
      playerNames: { 'player-1': 'Player 1' },
      turnOrder: ['player-1'],
      stateVersion: 10,
    }

    render(
      <MemoryRouter initialEntries={['/game?id=game-123']}>
        <AppProviders>
          <Routes>
            <Route path="/game" element={<GamePage />} />
            <Route path="/" element={<div>Home Page</div>} />
          </Routes>
        </AppProviders>
      </MemoryRouter>
    )

    if (gameStateUpdateCallback) {
      gameStateUpdateCallback({ gameState: endedState })
    }

    // Wait for and click the Back to Menu button
    const backToMenuButton = await screen.findByText(/Back to Menu/i)
    expect(backToMenuButton).toBeInTheDocument()

    backToMenuButton.click()

    // Verify clearCurrentGameId was called
    await waitFor(() => {
      expect(socketManager.clearCurrentGameId).toHaveBeenCalled()
    })

    // Verify navigation to home page
    await waitFor(() => {
      expect(screen.getByText('Home Page')).toBeInTheDocument()
    })
  })
})
