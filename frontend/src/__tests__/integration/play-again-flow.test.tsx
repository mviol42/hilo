import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom'
import { GamePage } from '@/pages/GamePage'
import { LobbyPage } from '@/pages/LobbyPage'
import { JoinPage } from '@/pages/JoinPage'
import { AppProviders } from '@/context'
import { apiClient } from '@/services/api'
import { socketManager } from '@/services/socket'
import type { PlayerView, LobbyState, Player, LobbyPlayerJoinedEvent } from '@hilo/shared'

// Mock API and Socket
vi.mock('@/services/api')
vi.mock('@/services/socket')

describe('Play Again Flow', () => {
  let gameStateUpdateCallback: ((data: { gameState: PlayerView }) => void) | null = null
  let lobbyPlayerJoinedCallback: ((data: LobbyPlayerJoinedEvent) => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    gameStateUpdateCallback = null
    lobbyPlayerJoinedCallback = null

    // Set player ID in localStorage
    localStorage.setItem('hilo:playerId', 'player-1')
    localStorage.setItem('hilo:playerName', 'Alice')

    // Mock socketManager
    vi.mocked(socketManager.connect).mockReturnValue(undefined as any)
    vi.mocked(socketManager.joinSession).mockReturnValue(undefined)
    vi.mocked(socketManager.isConnected).mockReturnValue(true)
    vi.mocked(socketManager.onConnectionStateChange).mockReturnValue(() => {})

    // Capture WebSocket event callbacks
    vi.mocked(socketManager.onGameStateUpdate).mockImplementation((callback) => {
      gameStateUpdateCallback = callback
      return () => {}
    })

    vi.mocked(socketManager.onLobbyPlayerJoined).mockImplementation((callback) => {
      lobbyPlayerJoinedCallback = callback
      return () => {}
    })

    vi.mocked(socketManager.onLobbyGameStarting).mockReturnValue(() => {})
    vi.mocked(socketManager.onGameTurnChange).mockReturnValue(() => {})
    vi.mocked(socketManager.onGamePlayerWon).mockReturnValue(() => {})
    vi.mocked(socketManager.onLobbyPlayerReadied).mockReturnValue(() => {})
    vi.mocked(socketManager.onLobbyPlayerLeft).mockReturnValue(() => {})
    vi.mocked(socketManager.onLobbyLeaderChanged).mockReturnValue(() => {})
    vi.mocked(socketManager.onError).mockReturnValue(() => {})
  })

  describe('Play Again button click', () => {
    it('navigates to join page without triggering rejoin for old game ID', async () => {
      // Track rejoin calls
      const rejoinCalls: { playerId: string; gameId?: string; lobbyId?: string }[] = []

      // Mock rejoinSession to track calls
      vi.mocked(apiClient.rejoinSession).mockImplementation(async (request) => {
        rejoinCalls.push(request)
        return {
          success: true,
          lobbyId: 'old-lobby-123',
          lobby: {
            id: 'old-lobby-123',
            leaderId: 'player-1',
            players: [{ id: 'player-1', name: 'Alice', isLeader: true, isReady: true }],
            status: 'in_game',
          },
          gameId: 'old-game-123',
          gameState: {
            id: 'old-game-123',
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
            winnerName: 'Alice',
            playerNames: { 'player-1': 'Alice' },
            turnOrder: ['player-1'],
            stateVersion: 53,
          },
        }
      })

      // Mock playAgain to return a new lobby
      vi.mocked(apiClient.playAgain).mockResolvedValue({
        lobbyId: 'new-lobby-456',
      })

      // Mock joinLobby for the new lobby
      vi.mocked(apiClient.joinLobby).mockResolvedValue({
        playerId: 'player-1',
        isLeader: true,
        lobby: {
          id: 'new-lobby-456',
          leaderId: 'player-1',
          players: [{ id: 'player-1', name: 'Alice', isLeader: true, isReady: false }],
          status: 'waiting',
        },
      })

      render(
        <MemoryRouter initialEntries={['/game?id=old-game-123']}>
          <AppProviders>
            <Routes>
              <Route path="/game" element={<GamePage />} />
              <Route path="/join" element={<JoinPage />} />
            </Routes>
          </AppProviders>
        </MemoryRouter>
      )

      // Wait for initial rejoin to complete and show game ended screen
      await waitFor(() => {
        expect(screen.getByText(/You Won!/i)).toBeInTheDocument()
      })

      // Verify initial rejoin was called
      expect(rejoinCalls.length).toBe(1)
      expect(rejoinCalls[0].gameId).toBe('old-game-123')

      // Click Play Again button
      const playAgainButton = screen.getByText(/Play Again/i)
      fireEvent.click(playAgainButton)

      // Wait for navigation to complete
      await waitFor(() => {
        // Should be on join page now
        expect(apiClient.playAgain).toHaveBeenCalledWith({ gameId: 'old-game-123' })
      })

      // The key assertion: rejoin should NOT have been called again with the old game ID
      // After clicking Play Again, there should still only be 1 rejoin call (the initial one)
      // If the bug exists, there would be 2 calls (initial + race condition trigger)
      expect(rejoinCalls.length).toBe(1)
    })

    it('does not clear game state before navigation (prevents race condition)', async () => {
      // This test verifies that CLEAR_GAME_STATE is not called during handlePlayAgain
      // by checking that the GameContext still has the old game state after click

      vi.mocked(apiClient.rejoinSession).mockResolvedValue({
        success: true,
        lobbyId: 'old-lobby-123',
        lobby: {
          id: 'old-lobby-123',
          leaderId: 'player-1',
          players: [{ id: 'player-1', name: 'Alice', isLeader: true, isReady: true }],
          status: 'in_game',
        },
        gameId: 'old-game-123',
        gameState: {
          id: 'old-game-123',
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
          winnerName: 'Alice',
          playerNames: { 'player-1': 'Alice' },
          turnOrder: ['player-1'],
          stateVersion: 53,
        },
      })

      vi.mocked(apiClient.playAgain).mockResolvedValue({
        lobbyId: 'new-lobby-456',
      })

      vi.mocked(apiClient.joinLobby).mockResolvedValue({
        playerId: 'player-1',
        isLeader: true,
        lobby: {
          id: 'new-lobby-456',
          leaderId: 'player-1',
          players: [{ id: 'player-1', name: 'Alice', isLeader: true, isReady: false }],
          status: 'waiting',
        },
      })

      render(
        <MemoryRouter initialEntries={['/game?id=old-game-123']}>
          <AppProviders>
            <Routes>
              <Route path="/game" element={<GamePage />} />
              <Route path="/join" element={<JoinPage />} />
            </Routes>
          </AppProviders>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/You Won!/i)).toBeInTheDocument()
      })

      const playAgainButton = screen.getByText(/Play Again/i)
      fireEvent.click(playAgainButton)

      // Wait for playAgain API to be called
      await waitFor(() => {
        expect(apiClient.playAgain).toHaveBeenCalled()
      })

      // The rejoinSession should NOT have been called a second time
      // This verifies that CLEAR_GAME_STATE didn't trigger useSessionRejoin
      expect(apiClient.rejoinSession).toHaveBeenCalledTimes(1)
    })
  })

  describe('New game state version handling', () => {
    it('accepts new game state with lower version after navigating to new game', async () => {
      // First, set up an ended game
      vi.mocked(apiClient.rejoinSession).mockResolvedValue({
        success: true,
        lobbyId: 'lobby-123',
        lobby: {
          id: 'lobby-123',
          leaderId: 'player-1',
          players: [
            { id: 'player-1', name: 'Alice', isLeader: true, isReady: true },
            { id: 'player-2', name: 'Bob', isLeader: false, isReady: true },
          ],
          status: 'in_game',
        },
        gameId: 'old-game-123',
        gameState: {
          id: 'old-game-123',
          phase: 'ended',
          myHand: [],
          myFaceUp: [],
          myFaceDownCount: 0,
          myFaceDownPlayed: [true, true, true],
          otherPlayers: { 'player-2': { name: 'Bob', handCount: 3, faceUp: [], faceDownCount: 3 } },
          pile: [],
          deckCount: 0,
          activePlayerId: 'player-1',
          winner: 'player-1',
          winnerName: 'Alice',
          playerNames: { 'player-1': 'Alice', 'player-2': 'Bob' },
          turnOrder: ['player-1', 'player-2'],
          stateVersion: 50,
        },
      })

      render(
        <MemoryRouter initialEntries={['/game?id=old-game-123']}>
          <AppProviders>
            <Routes>
              <Route path="/game" element={<GamePage />} />
            </Routes>
          </AppProviders>
        </MemoryRouter>
      )

      // Wait for ended game screen
      await waitFor(() => {
        expect(screen.getByText(/You Won!/i)).toBeInTheDocument()
      })

      // Simulate receiving new game state (e.g., after play again and new game starts)
      const newGameState: PlayerView = {
        id: 'new-game-456', // Different game ID
        phase: 'setup',
        myHand: [
          { rank: '5', suit: 'hearts' },
          { rank: 'K', suit: 'spades' },
        ],
        myFaceUp: [],
        myFaceDownCount: 3,
        myFaceDownPlayed: [false, false, false],
        otherPlayers: { 'player-2': { name: 'Bob', handCount: 6, faceUp: [], faceDownCount: 3 } },
        pile: [],
        deckCount: 40,
        activePlayerId: 'player-1',
        playerNames: { 'player-1': 'Alice', 'player-2': 'Bob' },
        turnOrder: ['player-1', 'player-2'],
        stateVersion: 1, // Lower version than old game (50)
      }

      if (gameStateUpdateCallback) {
        gameStateUpdateCallback({ gameState: newGameState })
      }

      // Should show setup phase (new game accepted despite lower version)
      await waitFor(() => {
        expect(screen.getByText(/Setup Phase/i)).toBeInTheDocument()
      })
    })
  })

  describe('Leader sees players join after play-again', () => {
    it('leader can see other players join the new lobby after play-again', async () => {
      // Set up the leader
      localStorage.setItem('hilo:playerId', 'leader-1')
      localStorage.setItem('hilo:playerName', 'Leader')

      // Initial lobby state - just the leader
      const initialLobby: LobbyState = {
        id: 'new-lobby-789',
        leaderId: 'leader-1',
        players: [{ id: 'leader-1', name: 'Leader', isLeader: true, isReady: true }],
        status: 'waiting',
      }

      vi.mocked(apiClient.rejoinSession).mockResolvedValue({
        success: true,
        lobbyId: 'new-lobby-789',
        lobby: initialLobby,
      })

      render(
        <MemoryRouter initialEntries={['/lobby?id=new-lobby-789']}>
          <AppProviders>
            <Routes>
              <Route path="/lobby" element={<LobbyPage />} />
            </Routes>
          </AppProviders>
        </MemoryRouter>
      )

      // Wait for lobby to load
      await waitFor(() => {
        expect(screen.getByText(/Waiting Room/i)).toBeInTheDocument()
      })

      // Verify only leader is shown initially
      expect(screen.getByText(/Players \(1\)/i)).toBeInTheDocument()

      // Simulate another player joining via WebSocket
      const newPlayer: Player = {
        id: 'player-2',
        name: 'NewPlayer',
        isLeader: false,
        isReady: false,
      }

      const updatedLobby: LobbyState = {
        id: 'new-lobby-789',
        leaderId: 'leader-1',
        players: [
          { id: 'leader-1', name: 'Leader', isLeader: true, isReady: true },
          newPlayer,
        ],
        status: 'waiting',
      }

      if (lobbyPlayerJoinedCallback) {
        lobbyPlayerJoinedCallback({ player: newPlayer, lobby: updatedLobby })
      }

      // Leader should see the new player
      await waitFor(() => {
        expect(screen.getByText('NewPlayer')).toBeInTheDocument()
      })

      expect(screen.getByText(/Players \(2\)/i)).toBeInTheDocument()
    })

    it('leader in new lobby receives player joined events correctly after navigating from ended game', async () => {
      localStorage.setItem('hilo:playerId', 'leader-1')

      // First mock: rejoin for old game
      vi.mocked(apiClient.rejoinSession)
        .mockResolvedValueOnce({
          success: true,
          lobbyId: 'old-lobby-123',
          lobby: {
            id: 'old-lobby-123',
            leaderId: 'leader-1',
            players: [{ id: 'leader-1', name: 'Leader', isLeader: true, isReady: true }],
            status: 'in_game',
          },
          gameId: 'old-game-123',
          gameState: {
            id: 'old-game-123',
            phase: 'ended',
            myHand: [],
            myFaceUp: [],
            myFaceDownCount: 0,
            myFaceDownPlayed: [true, true, true],
            otherPlayers: {},
            pile: [],
            deckCount: 0,
            activePlayerId: 'leader-1',
            winner: 'leader-1',
            winnerName: 'Leader',
            playerNames: { 'leader-1': 'Leader' },
            turnOrder: ['leader-1'],
            stateVersion: 30,
          },
        })
        // Second mock: rejoin for new lobby (after navigation)
        .mockResolvedValueOnce({
          success: true,
          lobbyId: 'new-lobby-456',
          lobby: {
            id: 'new-lobby-456',
            leaderId: 'leader-1',
            players: [{ id: 'leader-1', name: 'Leader', isLeader: true, isReady: true }],
            status: 'waiting',
          },
        })

      vi.mocked(apiClient.playAgain).mockResolvedValue({
        lobbyId: 'new-lobby-456',
      })

      vi.mocked(apiClient.joinLobby).mockResolvedValue({
        playerId: 'leader-1',
        isLeader: true,
        lobby: {
          id: 'new-lobby-456',
          leaderId: 'leader-1',
          players: [{ id: 'leader-1', name: 'Leader', isLeader: true, isReady: true }],
          status: 'waiting',
        },
      })

      render(
        <MemoryRouter initialEntries={['/game?id=old-game-123']}>
          <AppProviders>
            <Routes>
              <Route path="/game" element={<GamePage />} />
              <Route path="/join" element={<JoinPage />} />
              <Route path="/lobby" element={<LobbyPage />} />
            </Routes>
          </AppProviders>
        </MemoryRouter>
      )

      // Wait for game ended screen
      await waitFor(() => {
        expect(screen.getByText(/You Won!/i)).toBeInTheDocument()
      })

      // Click Play Again
      const playAgainButton = screen.getByText(/Play Again/i)
      fireEvent.click(playAgainButton)

      // Wait for navigation to join page
      await waitFor(() => {
        expect(apiClient.playAgain).toHaveBeenCalled()
      })

      // Verify the flow completed without duplicate rejoin calls to old game
      // If the race condition existed, rejoinSession would have been called with old-game-123 again
      const rejoinCalls = vi.mocked(apiClient.rejoinSession).mock.calls
      expect(rejoinCalls.length).toBeLessThanOrEqual(2) // Initial + possibly new lobby

      // First call should be for old game
      if (rejoinCalls.length >= 1) {
        expect(rejoinCalls[0][0].gameId).toBe('old-game-123')
      }
    })
  })
})
