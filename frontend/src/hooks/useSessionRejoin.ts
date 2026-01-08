import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { usePlayer, useLobby, useGame } from '@/context'
import { apiClient } from '@/services/api'
import { socketManager } from '@/services/socket'

interface UseSessionRejoinOptions {
  type: 'lobby' | 'game'
}

interface UseSessionRejoinResult {
  isRejoining: boolean
  rejoinError: string | null
  errorCode: string | null
}

/**
 * Hook to handle session rejoin from URL-based IDs.
 *
 * This hook:
 * 1. Reads the ID from URL query params (`?id=xxx`)
 * 2. Calls the rejoin API to validate player membership and get state
 * 3. Updates LobbyContext and GameContext with server state
 * 4. Connects to WebSocket and joins rooms
 * 5. Handles redirects for error cases
 * 6. Re-joins rooms on WebSocket reconnection
 *
 * @param options.type - Whether this is a lobby or game page
 * @returns Object with isRejoining, rejoinError, and errorCode
 */
export function useSessionRejoin({ type }: UseSessionRejoinOptions): UseSessionRejoinResult {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { playerId } = usePlayer()
  const { lobby, dispatch: lobbyDispatch } = useLobby()
  const { gameState, dispatch: gameDispatch } = useGame()

  const [isRejoining, setIsRejoining] = useState(true)
  const [rejoinError, setRejoinError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const hasRejoined = useRef(false)

  // Store resolved IDs for reconnection
  const resolvedLobbyId = useRef<string | null>(null)
  const resolvedGameId = useRef<string | null>(null)

  const id = searchParams.get('id')

  // Rejoin function - called on initial load and reconnection
  const performRejoin = useCallback(async () => {
    if (!id) {
      navigate('/')
      return
    }

    if (!playerId) {
      setRejoinError('Player ID not found')
      setIsRejoining(false)
      return
    }

    try {
      const request = type === 'game'
        ? { playerId, gameId: id }
        : { playerId, lobbyId: id }

      const response = await apiClient.rejoinSession(request)

      // Store resolved IDs for reconnection
      resolvedLobbyId.current = response.lobbyId
      resolvedGameId.current = response.gameId || null

      // Update lobby context
      lobbyDispatch({ type: 'SET_LOBBY', payload: response.lobby })

      // Update game context if applicable
      if (response.gameState) {
        gameDispatch({ type: 'SET_GAME_STATE', payload: response.gameState })
      }

      // Connect to WebSocket and join rooms
      socketManager.connect()
      socketManager.joinSession(playerId, response.lobbyId, response.gameId)

      // Handle redirect if on wrong page
      if (type === 'lobby' && response.gameId) {
        // Was on lobby page but game is active - redirect to game
        navigate(`/game?id=${response.gameId}`, { replace: true })
      } else if (type === 'game' && !response.gameId) {
        // Was on game page but no active game - redirect to lobby
        navigate(`/lobby?id=${response.lobbyId}`, { replace: true })
      }

      setIsRejoining(false)
      setRejoinError(null)
      setErrorCode(null)
    } catch (error: any) {
      const code = error.response?.data?.code
      const message = error.response?.data?.message || 'Failed to rejoin session'
      const status = error.response?.status

      setRejoinError(message)
      setErrorCode(code || null)
      setIsRejoining(false)

      // Handle specific error cases with redirects
      if (code === 'NOT_IN_LOBBY' && type === 'lobby') {
        // Player not in this lobby - redirect to join page
        navigate(`/join?id=${id}`, { replace: true })
      } else if (status === 404) {
        // Lobby/game not found - redirect home
        navigate('/', { replace: true })
      }
    }
  }, [id, playerId, type, navigate, lobbyDispatch, gameDispatch])

  // Initial rejoin on mount
  useEffect(() => {
    // Skip if already have the right state (prevents re-running on state updates)
    if (type === 'lobby' && lobby?.id === id) {
      setIsRejoining(false)
      return
    }
    if (type === 'game' && gameState?.id === id) {
      setIsRejoining(false)
      return
    }

    // Prevent duplicate rejoin attempts
    if (hasRejoined.current) return
    hasRejoined.current = true

    performRejoin()
  }, [id, type, lobby?.id, gameState?.id, performRejoin])

  // Handle WebSocket reconnection - re-join rooms
  useEffect(() => {
    if (!resolvedLobbyId.current) return

    const unsubscribe = socketManager.onConnectionStateChange((info) => {
      if (info.state === 'connected') {
        // Re-join rooms on reconnect
        const lobbyId = resolvedLobbyId.current
        const gameId = resolvedGameId.current

        if (lobbyId && playerId) {
          console.log('[useSessionRejoin] Reconnected, rejoining session')
          socketManager.joinSession(playerId, lobbyId, gameId || undefined)
        }
      }
    })

    return unsubscribe
  }, [playerId])

  return { isRejoining, rejoinError, errorCode }
}
