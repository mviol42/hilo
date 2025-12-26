import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { apiClient } from '@/services/api'
import { socketManager } from '@/services/socket'
import { usePlayer, useLobby, useUI, useGame } from '@/context'
import { Button, Input, PlayerList } from '@/components'
import { copyToClipboard, getLobbyShareLink } from '@/utils/url'

export function LobbyPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const lobbyId = searchParams.get('id')

  const { playerId, playerName, setPlayerName } = usePlayer()
  const { lobby, isLeader, dispatch: lobbyDispatch } = useLobby()
  const { showToast, setIsLoading } = useUI()
  const { dispatch: gameDispatch } = useGame()

  const [nameInput, setNameInput] = useState(playerName || '')
  const [isReady, setIsReady] = useState(false)

  // Redirect to landing if no lobby ID
  useEffect(() => {
    if (!lobbyId) {
      navigate('/')
    }
  }, [lobbyId, navigate])

  // Set up WebSocket listener for game starting
  useEffect(() => {
    const cleanup = socketManager.onLobbyGameStarting((data) => {
      console.log('[LobbyPage] lobby:gameStarting event received:', {
        gameId: data.gameId?.substring(0, 8),
        lobbyId: lobbyId?.substring(0, 8),
        playerId: playerId?.substring(0, 8),
      })
      // Navigate to game page when leader starts game
      // Note: The initial game state should come via game:stateUpdate WebSocket event
      navigate(`/game?id=${data.gameId}`)
    })

    return cleanup
  }, [navigate, lobbyId, playerId])

  const handleCopyLink = async () => {
    if (!lobbyId) return

    const link = getLobbyShareLink(lobbyId)
    const success = await copyToClipboard(link)

    if (success) {
      showToast('Link copied to clipboard!', 'success')
    } else {
      showToast('Failed to copy link', 'error')
    }
  }

  const handleCopyLobbyId = async () => {
    if (!lobbyId) return

    const success = await copyToClipboard(lobbyId)

    if (success) {
      showToast('Lobby ID copied to clipboard!', 'success')
    } else {
      showToast('Failed to copy lobby ID', 'error')
    }
  }

  const handleUpdateName = async () => {
    const trimmedName = nameInput.trim()
    if (trimmedName && trimmedName !== playerName) {
      setPlayerName(trimmedName)
      showToast('Name updated!', 'success')
    }
  }

  const handleReady = async () => {
    if (!lobbyId || !playerId) return

    try {
      setIsLoading(true)
      await apiClient.readyLobby({
        lobbyId,
        playerId,
      })
      setIsReady(true)
      showToast('You are ready!', 'success')
    } catch (error: any) {
      console.error('Failed to mark ready:', error)
      const message = error.response?.data?.message
      showToast(message || 'Failed to mark as ready', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartGame = async () => {
    if (!lobbyId || !playerId) return

    console.log('[LobbyPage] handleStartGame - lobbyId:', lobbyId?.substring(0, 8), 'playerId:', playerId?.substring(0, 8))

    try {
      setIsLoading(true)
      const response = await apiClient.startGame({
        lobbyId,
        playerId,
      })

      console.log('[LobbyPage] Game started successfully, gameState.id:', response.gameState.id?.substring(0, 20), 'navigating to:', `/game?id=${response.gameState.id}`)

      // Initialize game state from API response (for leader)
      gameDispatch({ type: 'SET_GAME_STATE', payload: response.gameState })

      // Game started successfully, navigate to game page
      // IMPORTANT: Use gameState.id (not lobbyId) because gameId format is ${lobbyId}:game:${uuid}
      navigate(`/game?id=${response.gameState.id}`)
    } catch (error: any) {
      console.error('[LobbyPage] Failed to start game:', error)

      const message = error.response?.data?.message
      if (message) {
        showToast(message, 'error')
      } else {
        showToast('Failed to start game', 'error')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleLeaveLobby = async () => {
    if (!lobbyId || !playerId) return

    try {
      setIsLoading(true)
      await apiClient.leaveLobby({
        lobbyId,
        playerId,
      })

      // Clear lobby state
      lobbyDispatch({ type: 'CLEAR_LOBBY' })

      // Navigate back to landing
      navigate('/')
    } catch (error: any) {
      console.error('Failed to leave lobby:', error)
      showToast('Failed to leave lobby', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  if (!lobbyId) {
    return null
  }

  // Check if all non-leader players are ready
  const allPlayersReady = lobby?.players.every(
    (p) => p.id === lobby.leaderId || p.isReady
  ) || false

  const canStartGame = isLeader(playerId) && (lobby?.players.length || 0) >= 2 && allPlayersReady

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-indigo-700 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Waiting Room</h1>
          <div className="flex items-center justify-center gap-2">
            <p className="text-gray-600 text-sm font-mono">
              Room ID: {lobbyId.substring(0, 8)}...
            </p>
            <button
              onClick={handleCopyLobbyId}
              className="text-purple-600 hover:text-purple-700 p-1 rounded hover:bg-purple-50 transition-colors"
              title="Copy lobby ID"
            >
              📋
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Player Name Input */}
          <div>
            <Input
              type="text"
              placeholder="Your name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={handleUpdateName}
              maxLength={20}
            />
          </div>

          {/* Copy Link Button */}
          <div>
            <Button
              onClick={handleCopyLink}
              variant="secondary"
              fullWidth
            >
              📋 Copy Invite Link
            </Button>
          </div>

          {/* Player List */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Players ({lobby?.players.length || 0})
            </h2>
            {lobby && (
              <PlayerList
                players={lobby.players}
                leaderId={lobby.leaderId}
                currentPlayerId={playerId}
              />
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            {isLeader(playerId) ? (
              <>
                <Button
                  onClick={handleStartGame}
                  variant="primary"
                  size="large"
                  fullWidth
                  disabled={!canStartGame}
                >
                  Begin Game
                </Button>
                {!canStartGame && (
                  <p className="text-gray-600 text-sm text-center">
                    {(lobby?.players.length || 0) < 2
                      ? 'Waiting for at least 2 players...'
                      : 'Waiting for all players to be ready...'}
                  </p>
                )}
              </>
            ) : (
              <>
                <Button
                  onClick={handleReady}
                  variant="primary"
                  size="large"
                  fullWidth
                  disabled={isReady}
                >
                  {isReady ? '✓ Ready!' : 'Ready'}
                </Button>
                {isReady && (
                  <p className="text-gray-600 text-sm text-center">
                    Waiting for leader to start the game...
                  </p>
                )}
              </>
            )}
          </div>

          {/* Leave Button */}
          <div>
            <Button
              onClick={handleLeaveLobby}
              variant="danger"
              fullWidth
            >
              Leave Lobby
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
