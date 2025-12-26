# Task 5: Landing Page

## Goal

Implement the landing page with "Create Lobby" and "Join Lobby" functionality.

## Prerequisites

- Task 1: Project Setup completed
- Task 2: Routing and Navigation completed
- Task 3: API Client completed
- Task 4: State Management completed

## UI Requirements (from frontend-design.md)

- Two main buttons: "Create Lobby" and "Join Lobby"
- **Create Lobby**: Button that creates a new lobby and navigates to lobby page
- **Join Lobby**: Text input for room ID + Join button
- Display error messages in red text below input if lobby not found

## Implementation

### 1. Create Landing Page Component

Create `src/pages/LandingPage/index.tsx`:
```typescript
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '@/services/api'
import { socketManager } from '@/services/socket'
import { usePlayer, useUI, useLobby } from '@/context'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import './LandingPage.css'

export function LandingPage() {
  const navigate = useNavigate()
  const { playerId, playerName, setPlayerName } = usePlayer()
  const { showToast, setIsLoading } = useUI()
  const { dispatch: lobbyDispatch } = useLobby()

  const [lobbyIdInput, setLobbyIdInput] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [nameInput, setNameInput] = useState(playerName || '')

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

      // Connect to WebSocket room
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
    <div className="landing-page">
      <div className="landing-container">
        <h1 className="landing-title">Hi-Lo Card Game</h1>

        <div className="landing-content">
          {/* Player Name Input */}
          <div className="name-section">
            <Input
              type="text"
              placeholder="Your name (optional)"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={20}
            />
          </div>

          {/* Create Lobby */}
          <div className="create-section">
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
          <div className="divider">
            <span>OR</span>
          </div>

          {/* Join Lobby */}
          <div className="join-section">
            <div className="join-input-group">
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
              <p className="error-message">{joinError}</p>
            )}
          </div>
        </div>

        {/* Game Rules Link */}
        <div className="landing-footer">
          <a href="/rules" className="rules-link">How to Play</a>
        </div>
      </div>
    </div>
  )
}
```

### 2. Create Landing Page Styles

Create `src/pages/LandingPage/LandingPage.css`:
```css
.landing-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
}

.landing-container {
  background: white;
  border-radius: 1rem;
  padding: 3rem;
  max-width: 500px;
  width: 100%;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.landing-title {
  font-size: 2.5rem;
  font-weight: bold;
  text-align: center;
  margin-bottom: 2rem;
  color: #333;
}

.landing-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.name-section {
  /* Placeholder for name input */
}

.create-section {
  /* Placeholder for create button */
}

.divider {
  display: flex;
  align-items: center;
  text-align: center;
  color: #999;
  margin: 0.5rem 0;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid #ddd;
}

.divider span {
  padding: 0 1rem;
  font-size: 0.875rem;
}

.join-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.join-input-group {
  display: flex;
  gap: 0.5rem;
}

.join-input-group input {
  flex: 1;
}

.error-message {
  color: #ef4444;
  font-size: 0.875rem;
  margin: 0;
  padding-left: 0.25rem;
}

.landing-footer {
  margin-top: 2rem;
  text-align: center;
}

.rules-link {
  color: #667eea;
  text-decoration: none;
  font-size: 0.875rem;
}

.rules-link:hover {
  text-decoration: underline;
}

/* Mobile responsive */
@media (max-width: 640px) {
  .landing-container {
    padding: 2rem;
  }

  .landing-title {
    font-size: 2rem;
  }
}
```

## Component Breakdown

### Input Fields
1. **Player Name** (optional):
   - Default value from localStorage if exists
   - Saved when creating/joining lobby
   - Max 20 characters

2. **Lobby ID Input**:
   - Text input for UUID
   - Cleared error on change
   - Enter key triggers join

### Buttons
1. **Create Lobby**:
   - Primary button style
   - Full width
   - Calls `/api/lobby/create`
   - Automatically joins created lobby
   - Navigates to lobby page

2. **Join Lobby**:
   - Secondary button style
   - Inline with input
   - Calls `/api/lobby/join`
   - Shows error if lobby not found

## Error Handling

### Join Lobby Errors
```typescript
404 Not Found → "Lobby not found"
409 Conflict → "Cannot join lobby (game may have started)"
500 Server Error → "Failed to join lobby. Please try again."
```

### UI Feedback
- Error messages displayed in red below input
- Toast notifications for success/failure
- Loading state disables buttons during API calls

## User Flow

```
Landing Page
    |
    +---> Enter name (optional)
    |
    +---> Click "Create Lobby"
          |
          v
          API: POST /api/lobby/create
          |
          v
          API: POST /api/lobby/join (with new lobby ID)
          |
          v
          WebSocket: join room
          |
          v
          Navigate to /lobby?id={lobbyId}

    +---> Enter name (optional)
    |
    +---> Enter lobby ID
    |
    +---> Click "Join" or press Enter
          |
          v
          API: POST /api/lobby/join
          |
          v
          WebSocket: join room
          |
          v
          Navigate to /lobby?id={lobbyId}
          (or show error if failed)
```

## Testing

Create `src/pages/LandingPage/__tests__/LandingPage.test.tsx`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { LandingPage } from '../index'
import { AppProviders } from '@/context'
import { apiClient } from '@/services/api'

vi.mock('@/services/api')

function renderLandingPage() {
  return render(
    <BrowserRouter>
      <AppProviders>
        <LandingPage />
      </AppProviders>
    </BrowserRouter>
  )
}

describe('LandingPage', () => {
  it('renders create and join buttons', () => {
    renderLandingPage()
    expect(screen.getByText('Create Lobby')).toBeInTheDocument()
    expect(screen.getByText('Join')).toBeInTheDocument()
  })

  it('creates lobby on button click', async () => {
    vi.mocked(apiClient.createLobby).mockResolvedValue({ lobbyId: 'test-123' })
    vi.mocked(apiClient.joinLobby).mockResolvedValue({
      playerId: 'player-1',
      isLeader: true,
      lobby: { id: 'test-123', players: [], leaderId: 'player-1', status: 'waiting' },
    })

    renderLandingPage()

    const createButton = screen.getByText('Create Lobby')
    fireEvent.click(createButton)

    await waitFor(() => {
      expect(apiClient.createLobby).toHaveBeenCalled()
    })
  })

  it('shows error when joining invalid lobby', async () => {
    vi.mocked(apiClient.joinLobby).mockRejectedValue({
      response: { status: 404, data: { message: 'Lobby not found' } },
    })

    renderLandingPage()

    const input = screen.getByPlaceholderText('Enter room id...')
    const joinButton = screen.getByText('Join')

    fireEvent.change(input, { target: { value: 'invalid-id' } })
    fireEvent.click(joinButton)

    await waitFor(() => {
      expect(screen.getByText('Lobby not found')).toBeInTheDocument()
    })
  })
})
```

## Output Files

- `/frontend/src/pages/LandingPage/index.tsx` - Landing page component
- `/frontend/src/pages/LandingPage/LandingPage.css` - Landing page styles
- `/frontend/src/pages/LandingPage/__tests__/LandingPage.test.tsx` - Landing page tests

## Next Steps

- Task 6: Implement Lobby Page
- Task 8: Create reusable Button and Input components

## Notes

- Player ID is auto-generated on first visit (handled by PlayerContext)
- Player name is optional and defaults to previous name from localStorage
- Both "Create" and "Join" paths call `joinLobby` API
- WebSocket connection established immediately after joining
- Loading state prevents double-clicks during API calls
