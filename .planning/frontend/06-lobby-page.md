# Task 6: Lobby Page

## Goal

Implement the lobby page where players wait for others to join and the leader can start the game.

## Prerequisites

- Task 1: Project Setup completed
- Task 2: Routing completed
- Task 3: API Client completed
- Task 4: State Management completed

## UI Requirements (from frontend-design.md)

- **Copy Link button**: Copies shareable lobby URL to clipboard
- **Leader**:
  - Can see "Begin Game" button
  - Button disabled until at least 2 players and all non-leader players are ready
- **Non-leaders**:
  - Have a "Ready" button to mark themselves as ready
  - Button becomes "✓ Ready!" after clicking and is disabled
  - See waiting indicator while waiting for leader to start
- **Player List**:
  - Shows all players in lobby
  - Indicates leader with badge
  - Shows ready status for each player
- **Player Name Input**:
  - Can set/edit display name
  - Stored in browser cache
  - Default is previously entered name

## Implementation

### 1. Create Lobby Page Component

Create `src/pages/LobbyPage/index.tsx`:
```typescript
import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { apiClient } from '@/services/api'
import { socketManager } from '@/services/socket'
import { usePlayer, useLobby, useUI } from '@/context'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { PlayerList } from '@/components/PlayerList'
import { copyToClipboard, getLobbyShareLink } from '@/utils/url'
import './LobbyPage.css'

export function LobbyPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const lobbyId = searchParams.get('id')

  const { playerId, playerName, setPlayerName } = usePlayer()
  const { lobby, isLeader, dispatch: lobbyDispatch } = useLobby()
  const { showToast, setIsLoading } = useUI()

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
      // Navigate to game page when leader starts game
      navigate(`/game?id=${data.gameId}`)
    })

    return cleanup
  }, [navigate])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (lobbyId && playerId) {
        // Leave lobby on unmount (optional)
        // socketManager.leaveLobby(lobbyId, playerId)
      }
    }
  }, [lobbyId, playerId])

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
      showToast('Failed to mark as ready', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartGame = async () => {
    if (!lobbyId || !playerId) return

    try {
      setIsLoading(true)
      const response = await apiClient.startGame({
        lobbyId,
        playerId,
      })

      // Game started successfully, navigate to game page
      navigate(`/game?id=${lobbyId}`)
    } catch (error: any) {
      console.error('Failed to start game:', error)

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

  const canStartGame = isLeader && (lobby?.players.length || 0) >= 2 && allPlayersReady

  return (
    <div className="lobby-page">
      <div className="lobby-container">
        <div className="lobby-header">
          <h1 className="lobby-title">Waiting Room</h1>
          <p className="lobby-id">Room ID: {lobbyId.substring(0, 8)}...</p>
        </div>

        <div className="lobby-content">
          {/* Player Name Input */}
          <div className="name-section">
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
          <div className="copy-link-section">
            <Button
              onClick={handleCopyLink}
              variant="secondary"
              fullWidth
            >
              📋 Copy Invite Link
            </Button>
          </div>

          {/* Player List */}
          <div className="player-list-section">
            <h2 className="section-title">Players ({lobby?.players.length || 0})</h2>
            {lobby && (
              <PlayerList
                players={lobby.players}
                leaderId={lobby.leaderId}
                currentPlayerId={playerId}
              />
            )}
          </div>

          {/* Action Buttons */}
          <div className="action-section">
            {isLeader ? (
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
                  <p className="help-text">
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
                  <p className="help-text">
                    Waiting for leader to start the game...
                  </p>
                )}
              </>
            )}
          </div>

          {/* Leave Button */}
          <div className="leave-section">
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
```

### 2. Create Lobby Page Styles

Create `src/pages/LobbyPage/LobbyPage.css`:
```css
.lobby-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
}

.lobby-container {
  background: white;
  border-radius: 1rem;
  padding: 2rem;
  max-width: 600px;
  width: 100%;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.lobby-header {
  text-align: center;
  margin-bottom: 2rem;
}

.lobby-title {
  font-size: 2rem;
  font-weight: bold;
  color: #333;
  margin-bottom: 0.5rem;
}

.lobby-id {
  color: #666;
  font-size: 0.875rem;
  font-family: monospace;
}

.lobby-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #333;
  margin-bottom: 1rem;
}

.help-text {
  color: #666;
  font-size: 0.875rem;
  text-align: center;
  margin-top: 0.5rem;
}

/* Mobile responsive */
@media (max-width: 640px) {
  .lobby-container {
    padding: 1.5rem;
  }

  .lobby-title {
    font-size: 1.5rem;
  }
}
```

### 3. Create Player List Component

Create `src/components/PlayerList/index.tsx`:
```typescript
import type { Player, PlayerId } from '@hilo/shared'
import './PlayerList.css'

interface PlayerListProps {
  players: Player[]
  leaderId: PlayerId
  currentPlayerId: PlayerId
}

export function PlayerList({ players, leaderId, currentPlayerId }: PlayerListProps) {
  return (
    <div className="player-list">
      {players.map((player) => (
        <div
          key={player.id}
          className={`player-item ${player.id === currentPlayerId ? 'current-player' : ''}`}
        >
          <div className="player-info">
            <span className="player-name">
              {player.name || `Player ${player.id.substring(0, 8)}`}
            </span>
            {player.id === leaderId && (
              <span className="leader-badge">Leader</span>
            )}
            {player.id === currentPlayerId && (
              <span className="you-badge">You</span>
            )}
          </div>
          <div className="player-status">
            {player.id === leaderId ? (
              <span className="status-text">Host</span>
            ) : player.isReady ? (
              <span className="status-ready">✓ Ready</span>
            ) : (
              <span className="status-waiting">Waiting...</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
```

Create `src/components/PlayerList/PlayerList.css`:
```css
.player-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.player-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #f9fafb;
}

.player-item.current-player {
  background: #eff6ff;
  border-color: #3b82f6;
}

.player-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.player-name {
  font-weight: 500;
  color: #333;
}

.leader-badge {
  background: #fbbf24;
  color: white;
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-weight: 600;
}

.you-badge {
  background: #3b82f6;
  color: white;
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-weight: 600;
}

.player-status {
  font-size: 0.875rem;
}

.status-ready {
  color: #10b981;
  font-weight: 600;
}

.status-waiting {
  color: #9ca3af;
}

.status-text {
  color: #6b7280;
}
```

## WebSocket Events Handled

### Lobby Events
- `lobby:playerJoined` - Update player list when new player joins
- `lobby:playerLeft` - Update player list when player leaves
- `lobby:playerReadied` - Update ready status for player
- `lobby:leaderChanged` - Update leader when current leader leaves
- `lobby:gameStarting` - Navigate to game page

These events are handled by `LobbyContext` and automatically update the UI.

## User Flow

```
Lobby Page Load
    |
    v
Check lobbyId in URL
    |
    +---> No ID → Redirect to landing page
    |
    +---> Has ID → Continue
          |
          v
Display lobby state from LobbyContext
    |
    v
User Actions:
    |
    +---> Copy Link → Copy to clipboard
    |
    +---> Update Name → Save to localStorage
    |
    +---> [Non-Leader] Ready → POST /api/lobby/ready
    |         |
    |         v
    |     WebSocket: lobby:playerReadied → Update UI
    |
    +---> [Leader] Begin Game → POST /api/game/start
    |         |
    |         v
    |     WebSocket: lobby:gameStarting → All players navigate to game
    |
    +---> Leave Lobby → POST /api/lobby/leave → Navigate to landing
```

## Testing

Create `src/pages/LobbyPage/__tests__/LobbyPage.test.tsx`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { LobbyPage } from '../index'
import { AppProviders } from '@/context'

// TODO: Add comprehensive tests

describe('LobbyPage', () => {
  it('renders lobby page', () => {
    // Test implementation
  })
})
```

## Output Files

- `/frontend/src/pages/LobbyPage/index.tsx` - Lobby page component
- `/frontend/src/pages/LobbyPage/LobbyPage.css` - Lobby page styles
- `/frontend/src/components/PlayerList/index.tsx` - Player list component
- `/frontend/src/components/PlayerList/PlayerList.css` - Player list styles

## Next Steps

- Task 7: Implement Game Page
- Task 8: Create reusable UI components

## Notes

- WebSocket events automatically update lobby state via LobbyContext
- Leader cannot mark themselves as ready (only start game)
- Minimum 2 players required to start game
- All non-leader players must be ready before game can start
- Lobby ID displayed as truncated UUID for readability
- Player name changes are local only (not synced with backend in current design)
