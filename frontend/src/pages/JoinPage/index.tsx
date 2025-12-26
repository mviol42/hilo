import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { apiClient } from '@/services/api'
import { socketManager } from '@/services/socket'
import { usePlayer, useUI, useLobby } from '@/context'
import { Button, Input } from '@/components'

export function JoinPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const lobbyId = searchParams.get('id')

  const { playerId, playerName, setPlayerName } = usePlayer()
  const { showToast, setIsLoading } = useUI()
  const { dispatch: lobbyDispatch } = useLobby()

  const [nameInput, setNameInput] = useState(playerName || '')
  const [joinError, setJoinError] = useState<string | null>(null)

  // Redirect to landing if no lobby ID
  useEffect(() => {
    if (!lobbyId) {
      navigate('/')
    }
  }, [lobbyId, navigate])

  const handleJoinLobby = async () => {
    if (!lobbyId) return

    try {
      setIsLoading(true)
      setJoinError(null)

      // Save player name if provided
      if (nameInput.trim()) {
        setPlayerName(nameInput.trim())
      }

      // Join lobby via API
      const joinResponse = await apiClient.joinLobby({
        lobbyId: lobbyId.trim(),
        playerId,
        playerName: nameInput.trim() || undefined,
      })

      // Update lobby context
      lobbyDispatch({ type: 'SET_LOBBY', payload: joinResponse.lobby })

      // Connect to WebSocket room
      socketManager.connect()
      socketManager.joinLobby(lobbyId.trim(), playerId)

      // Navigate to lobby page
      navigate(`/lobby?id=${lobbyId.trim()}`)
      showToast('Joined lobby successfully!', 'success')
    } catch (error: any) {
      console.error('Failed to join lobby:', error)

      const status = error.response?.status
      const message = error.response?.data?.message

      if (status === 404) {
        setJoinError('This lobby no longer exists.')
      } else if (status === 409) {
        // Check if it's specifically about the game starting
        if (message?.includes('already in game')) {
          setJoinError('This game has already started. You cannot join an in-progress game.')
        } else if (message?.includes('Player ID already exists')) {
          // Player is already in the lobby, just redirect them
          navigate(`/lobby?id=${lobbyId?.trim()}`)
          return
        } else {
          setJoinError(message || 'Cannot join this lobby right now.')
        }
      } else if (!error.response) {
        // Network error - no response received
        setJoinError('Unable to connect to server. Please check your internet connection.')
      } else {
        setJoinError('Failed to join lobby. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleJoinLobby()
    }
  }

  if (!lobbyId) {
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-indigo-700 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-900">
          Join Game
        </h1>

        <div className="space-y-6">
          {/* Lobby ID Display */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lobby ID
            </label>
            <div className="px-4 py-2 bg-gray-100 rounded-lg text-gray-700 font-mono text-center">
              {lobbyId.substring(0, 8)}...
            </div>
          </div>

          {/* Player Name Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Name
            </label>
            <Input
              type="text"
              placeholder="Enter your name (optional)"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyPress={handleKeyPress}
              maxLength={20}
            />
          </div>

          {/* Join Button */}
          <div>
            <Button
              onClick={handleJoinLobby}
              variant="primary"
              size="large"
              fullWidth
            >
              Join Lobby
            </Button>
          </div>

          {/* Error Message */}
          {joinError && (
            <p className="text-red-600 text-sm text-center">{joinError}</p>
          )}

          {/* Back Link */}
          <div className="text-center">
            <button
              onClick={() => navigate('/')}
              className="text-purple-600 hover:text-purple-700 text-sm font-medium"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
