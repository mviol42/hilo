import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '@/services/api'
import { socketManager } from '@/services/socket'
import { usePlayer, useUI, useLobby } from '@/context'
import { Button, Input, HowToPlayModal } from '@/components'

export function LandingPage() {
  const navigate = useNavigate()
  const { playerId, playerName, setPlayerName } = usePlayer()
  const { showToast, setIsLoading } = useUI()
  const { dispatch: lobbyDispatch } = useLobby()

  const [lobbyIdInput, setLobbyIdInput] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [nameInput, setNameInput] = useState(playerName || '')
  const [showHowToPlay, setShowHowToPlay] = useState(false)

  const handleCreateLobby = async () => {
    try {
      setIsLoading(true)
      setJoinError(null)

      // Save player name if provided
      if (nameInput.trim()) {
        setPlayerName(nameInput.trim())
      }

      // Create lobby via API
      const response = await apiClient.createLobby()
      const { lobbyId } = response

      // Join the newly created lobby
      const joinResponse = await apiClient.joinLobby({
        lobbyId,
        playerId,
        playerName: nameInput.trim() || undefined,
      })

      // Update lobby context
      lobbyDispatch({ type: 'SET_LOBBY', payload: joinResponse.lobby })

      // Connect to WebSocket room
      socketManager.joinLobby(lobbyId, playerId)

      // Navigate to lobby page
      navigate(`/lobby?id=${lobbyId}`)
      showToast('Lobby created successfully!', 'success')
    } catch (error: any) {
      console.error('Failed to create lobby:', error)
      showToast('Failed to create lobby. Please try again.', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoinLobby = async () => {
    try {
      setIsLoading(true)
      setJoinError(null)

      if (!lobbyIdInput.trim()) {
        setJoinError('Please enter a room ID')
        return
      }

      // Save player name if provided
      if (nameInput.trim()) {
        setPlayerName(nameInput.trim())
      }

      // Join lobby via API
      const joinResponse = await apiClient.joinLobby({
        lobbyId: lobbyIdInput.trim(),
        playerId,
        playerName: nameInput.trim() || undefined,
      })

      // Update lobby context
      lobbyDispatch({ type: 'SET_LOBBY', payload: joinResponse.lobby })

      // Join WebSocket room
      socketManager.joinLobby(lobbyIdInput.trim(), playerId)

      // Navigate to lobby page
      navigate(`/lobby?id=${lobbyIdInput.trim()}`)
      showToast('Joined lobby successfully!', 'success')
    } catch (error: any) {
      console.error('Failed to join lobby:', error)

      const status = error.response?.status
      const message = error.response?.data?.message

      if (status === 404) {
        setJoinError('Lobby not found')
      } else if (status === 409) {
        setJoinError(message || 'Cannot join lobby (game may have started)')
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-indigo-700 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-900">
          Hi-Lo Card Game
        </h1>

        <div className="space-y-6">
          {/* Player Name Input */}
          <div>
            <Input
              type="text"
              placeholder="Your name (optional)"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={20}
            />
          </div>

          {/* Create Lobby */}
          <div>
            <Button
              onClick={handleCreateLobby}
              variant="primary"
              size="large"
              fullWidth
            >
              Create Lobby
            </Button>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">OR</span>
            </div>
          </div>

          {/* Join Lobby */}
          <div>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Enter room id..."
                value={lobbyIdInput}
                onChange={(e) => {
                  setLobbyIdInput(e.target.value)
                  setJoinError(null)
                }}
                onKeyPress={handleKeyPress}
                error={!!joinError}
              />
              <Button
                onClick={handleJoinLobby}
                variant="secondary"
              >
                Join
              </Button>
            </div>
            {joinError && (
              <p className="text-red-600 text-sm mt-2">{joinError}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              setShowHowToPlay(true)
            }}
            className="text-purple-600 hover:text-purple-700 text-sm font-medium cursor-pointer"
          >
            How to Play
          </a>
        </div>
      </div>

      <HowToPlayModal
        isOpen={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
      />
    </div>
  )
}
