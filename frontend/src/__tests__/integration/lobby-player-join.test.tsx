import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom'
import { LobbyPage } from '@/pages/LobbyPage'
import { JoinPage } from '@/pages/JoinPage'
import { AppProviders, useLobby } from '@/context'
import { apiClient } from '@/services/api'
import { socketManager } from '@/services/socket'
import * as playerUtils from '@/utils/player'
import type { LobbyState, Player } from '@hilo/shared'
import { useEffect } from 'react'

// Mock API and Socket
vi.mock('@/services/api')
vi.mock('@/services/socket')
vi.mock('@/utils/player')

// Helper component to track navigation
function LocationDisplay() {
  const location = useLocation()
  return <div data-testid="location-display">{location.pathname}{location.search}</div>
}

// Helper component to set initial lobby state
function LobbyStateInitializer({ lobby }: { lobby: LobbyState }) {
  const { dispatch } = useLobby()
  useEffect(() => {
    dispatch({ type: 'SET_LOBBY', payload: lobby })
  }, [dispatch, lobby])
  return null
}

describe('Lobby Player Join Integration', () => {
  let playerJoinedCallback: ((data: { player: Player; lobby: LobbyState }) => void) | null = null
  let playerLeftCallback: ((data: { playerId: string; lobby: LobbyState }) => void) | null = null

  const player1: Player = {
    id: 'player-1',
    name: 'Player 1',
    isReady: false,
    isLeader: true,
  }

  const player2: Player = {
    id: 'player-2',
    name: 'Player 2',
    isReady: false,
    isLeader: false,
  }

  const initialLobbyState: LobbyState = {
    id: 'lobby-123',
    players: [player1],
    leaderId: 'player-1',
    status: 'waiting',
  }

  const lobbyWithTwoPlayers: LobbyState = {
    id: 'lobby-123',
    players: [player1, player2],
    leaderId: 'player-1',
    status: 'waiting',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    playerJoinedCallback = null
    playerLeftCallback = null

    // Mock player utils - current user is player-1 (leader)
    vi.mocked(playerUtils.getPlayerId).mockReturnValue('player-1')
    vi.mocked(playerUtils.getPlayerName).mockReturnValue('Player 1')
    vi.mocked(playerUtils.getLobbyId).mockReturnValue('lobby-123')
    vi.mocked(playerUtils.getGameId).mockReturnValue(null)

    // Mock socketManager
    vi.mocked(socketManager.connect).mockReturnValue(undefined as any)
    vi.mocked(socketManager.joinLobby).mockReturnValue(undefined)
    vi.mocked(socketManager.isConnected).mockReturnValue(true)

    // Capture WebSocket event callbacks
    vi.mocked(socketManager.onLobbyPlayerJoined).mockImplementation((callback) => {
      playerJoinedCallback = callback
      return () => {}
    })

    vi.mocked(socketManager.onLobbyPlayerLeft).mockImplementation((callback) => {
      playerLeftCallback = callback
      return () => {}
    })

    vi.mocked(socketManager.onLobbyPlayerReadied).mockReturnValue(() => {})
    vi.mocked(socketManager.onLobbyLeaderChanged).mockReturnValue(() => {})
    vi.mocked(socketManager.onLobbyGameStarting).mockReturnValue(() => {})
    vi.mocked(socketManager.onGameStateUpdate).mockReturnValue(() => {})
    vi.mocked(socketManager.onGameTurnChange).mockReturnValue(() => {})
    vi.mocked(socketManager.onGamePlayerWon).mockReturnValue(() => {})
    vi.mocked(socketManager.onError).mockReturnValue(() => {})
  })

  it('should keep player 1 in lobby when player 2 joins via invite link', async () => {
    // Mock API - getLobbyStatus returns lobby exists
    vi.mocked(apiClient.getLobbyStatus).mockResolvedValue({
      exists: true,
      gameStarted: false,
      playerCount: 1,
    })

    // Render lobby page as player 1 (already in lobby)
    render(
      <MemoryRouter initialEntries={['/lobby?id=lobby-123']}>
        <AppProviders>
          <LobbyStateInitializer lobby={initialLobbyState} />
          <Routes>
            <Route path="/lobby" element={<LobbyPage />} />
            <Route path="/join" element={<div>Join Page</div>} />
            <Route path="/" element={<div>Home Page</div>} />
          </Routes>
          <LocationDisplay />
        </AppProviders>
      </MemoryRouter>
    )

    // Player 1 should see the lobby with just themselves
    await waitFor(() => {
      expect(screen.getByText('Waiting Room')).toBeInTheDocument()
    })

    expect(screen.getByText(/Player 1/)).toBeInTheDocument()
    expect(screen.getByText(/Players \(1\)/)).toBeInTheDocument()

    // Verify we're on the lobby page
    expect(screen.getByTestId('location-display')).toHaveTextContent('/lobby?id=lobby-123')

    // Now player 2 joins via invite link - server broadcasts lobby:playerJoined
    await act(async () => {
      if (playerJoinedCallback) {
        playerJoinedCallback({
          player: player2,
          lobby: lobbyWithTwoPlayers,
        })
      }
    })

    // Player 1 should STILL be on the lobby page (not kicked out)
    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/lobby?id=lobby-123')
    })

    // Player 1 should see both players now
    expect(screen.getByText(/Player 1/)).toBeInTheDocument()
    expect(screen.getByText(/Player 2/)).toBeInTheDocument()
    expect(screen.getByText(/Players \(2\)/)).toBeInTheDocument()
  })

  it('should NOT redirect player 1 when lobby state updates', async () => {
    vi.mocked(apiClient.getLobbyStatus).mockResolvedValue({
      exists: true,
      gameStarted: false,
      playerCount: 1,
    })

    render(
      <MemoryRouter initialEntries={['/lobby?id=lobby-123']}>
        <AppProviders>
          <LobbyStateInitializer lobby={initialLobbyState} />
          <Routes>
            <Route path="/lobby" element={<LobbyPage />} />
            <Route path="/join" element={<div>Join Page - SHOULD NOT SEE THIS</div>} />
            <Route path="/" element={<div>Home Page - SHOULD NOT SEE THIS</div>} />
          </Routes>
          <LocationDisplay />
        </AppProviders>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Waiting Room')).toBeInTheDocument()
    })

    // Simulate multiple rapid lobby updates (player joins)
    await act(async () => {
      if (playerJoinedCallback) {
        playerJoinedCallback({
          player: player2,
          lobby: lobbyWithTwoPlayers,
        })
      }
    })

    // Small delay to let any async effects settle
    await new Promise(resolve => setTimeout(resolve, 100))

    // Should NOT see join page or home page
    expect(screen.queryByText('Join Page - SHOULD NOT SEE THIS')).not.toBeInTheDocument()
    expect(screen.queryByText('Home Page - SHOULD NOT SEE THIS')).not.toBeInTheDocument()

    // Should still be on lobby page
    expect(screen.getByTestId('location-display')).toHaveTextContent('/lobby?id=lobby-123')
    expect(screen.getByText('Waiting Room')).toBeInTheDocument()
  })

  it('should handle player leaving without kicking remaining players', async () => {
    vi.mocked(apiClient.getLobbyStatus).mockResolvedValue({
      exists: true,
      gameStarted: false,
      playerCount: 2,
    })

    // Start with 2 players in lobby
    render(
      <MemoryRouter initialEntries={['/lobby?id=lobby-123']}>
        <AppProviders>
          <LobbyStateInitializer lobby={lobbyWithTwoPlayers} />
          <Routes>
            <Route path="/lobby" element={<LobbyPage />} />
            <Route path="/join" element={<div>Join Page</div>} />
            <Route path="/" element={<div>Home Page</div>} />
          </Routes>
          <LocationDisplay />
        </AppProviders>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Waiting Room')).toBeInTheDocument()
    })

    expect(screen.getByText(/Players \(2\)/)).toBeInTheDocument()

    // Player 2 leaves
    const lobbyAfterLeave: LobbyState = {
      id: 'lobby-123',
      players: [player1],
      leaderId: 'player-1',
      status: 'waiting',
    }

    await act(async () => {
      if (playerLeftCallback) {
        playerLeftCallback({
          playerId: 'player-2',
          lobby: lobbyAfterLeave,
        })
      }
    })

    // Player 1 should still be on lobby page
    expect(screen.getByTestId('location-display')).toHaveTextContent('/lobby?id=lobby-123')
    expect(screen.getByText(/Players \(1\)/)).toBeInTheDocument()
  })
})
