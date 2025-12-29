# Task 2: Routing and Navigation

## Goal

Set up React Router for page navigation, URL parameter handling, and browser history management.

## Prerequisites

- Task 1: Project Setup completed
- react-router-dom installed

## Pages to Route

1. **Landing Page** (`/`) - Create or join lobby
2. **Lobby Page** (`/lobby?id={lobbyId}`) - Wait for players and start game
3. **Game Page** (`/game?id={lobbyId}`) - Play the Hi-Lo game

## Implementation

### 1. Create Router Configuration

Create `src/router.tsx`:
```typescript
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { LandingPage } from '@/pages/LandingPage'
import { LobbyPage } from '@/pages/LobbyPage'
import { GamePage } from '@/pages/GamePage'
import { ErrorPage } from '@/pages/ErrorPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/lobby',
    element: <LobbyPage />,
  },
  {
    path: '/game',
    element: <GamePage />,
  },
])

export function Router() {
  return <RouterProvider router={router} />
}
```

### 2. Update Main App Component

Update `src/App.tsx`:
```typescript
import { Router } from './router'

function App() {
  return <Router />
}

export default App
```

### 3. Create Page Skeletons

#### Landing Page
Create `src/pages/LandingPage/index.tsx`:
```typescript
import { useNavigate } from 'react-router-dom'

export function LandingPage() {
  const navigate = useNavigate()

  const handleCreateLobby = async () => {
    // TODO: Call API to create lobby
    // navigate(`/lobby?id=${lobbyId}`)
  }

  const handleJoinLobby = async (lobbyId: string) => {
    // TODO: Call API to join lobby
    // navigate(`/lobby?id=${lobbyId}`)
  }

  return (
    <div className="landing-page">
      <h1>Hi-Lo Card Game</h1>
      <button onClick={handleCreateLobby}>Create Lobby</button>
      <div>
        <input type="text" placeholder="Enter room id..." />
        <button onClick={() => handleJoinLobby('test-id')}>Join</button>
      </div>
    </div>
  )
}
```

#### Lobby Page
Create `src/pages/LobbyPage/index.tsx`:
```typescript
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

export function LobbyPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const lobbyId = searchParams.get('id')

  useEffect(() => {
    if (!lobbyId) {
      // Redirect to landing if no lobby ID
      navigate('/')
    }
  }, [lobbyId, navigate])

  if (!lobbyId) {
    return null
  }

  return (
    <div className="lobby-page">
      <h1>Lobby {lobbyId}</h1>
      {/* TODO: Add lobby UI */}
    </div>
  )
}
```

#### Game Page
Create `src/pages/GamePage/index.tsx`:
```typescript
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

export function GamePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const gameId = searchParams.get('id')

  useEffect(() => {
    if (!gameId) {
      // Redirect to landing if no game ID
      navigate('/')
    }
  }, [gameId, navigate])

  if (!gameId) {
    return null
  }

  return (
    <div className="game-page">
      <h1>Game {gameId}</h1>
      {/* TODO: Add game UI */}
    </div>
  )
}
```

#### Error Page
Create `src/pages/ErrorPage/index.tsx`:
```typescript
import { useRouteError, Link } from 'react-router-dom'

export function ErrorPage() {
  const error = useRouteError() as Error

  return (
    <div className="error-page">
      <h1>Oops!</h1>
      <p>Sorry, an unexpected error has occurred.</p>
      <p className="error-message">
        {error?.message || 'Unknown error'}
      </p>
      <Link to="/">Return to Home</Link>
    </div>
  )
}
```

### 4. Create Navigation Hook

Create `src/hooks/useNavigation.ts`:
```typescript
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCallback } from 'react'

export function useNavigation() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const goToLanding = useCallback(() => {
    navigate('/')
  }, [navigate])

  const goToLobby = useCallback((lobbyId: string) => {
    navigate(`/lobby?id=${lobbyId}`)
  }, [navigate])

  const goToGame = useCallback((gameId: string) => {
    navigate(`/game?id=${gameId}`)
  }, [navigate])

  const getCurrentLobbyId = useCallback(() => {
    return searchParams.get('id')
  }, [searchParams])

  const getCurrentGameId = useCallback(() => {
    return searchParams.get('id')
  }, [searchParams])

  return {
    goToLanding,
    goToLobby,
    goToGame,
    getCurrentLobbyId,
    getCurrentGameId,
  }
}
```

### 5. Create URL Utility Functions

Create `src/utils/url.ts`:
```typescript
/**
 * Generate shareable lobby link
 */
export function getLobbyShareLink(lobbyId: string): string {
  const baseUrl = window.location.origin
  return `${baseUrl}/lobby?id=${lobbyId}`
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
    return false
  }
}

/**
 * Extract lobby ID from URL
 */
export function extractLobbyIdFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    return urlObj.searchParams.get('id')
  } catch {
    return null
  }
}
```

### 6. Add Browser History Management

Create `src/utils/history.ts`:
```typescript
/**
 * Prevent accidental navigation away from game
 */
export function preventNavigation(message: string = 'Are you sure you want to leave? Your game progress will be lost.') {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    e.preventDefault()
    e.returnValue = message
    return message
  }

  window.addEventListener('beforeunload', handleBeforeUnload)

  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload)
  }
}
```

## Testing

Create `src/pages/__tests__/routing.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LandingPage } from '../LandingPage'
import { LobbyPage } from '../LobbyPage'
import { GamePage } from '../GamePage'

describe('Routing', () => {
  it('renders landing page at /', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <LandingPage />
      </MemoryRouter>
    )
    expect(screen.getByText(/Hi-Lo Card Game/i)).toBeInTheDocument()
  })

  it('renders lobby page with ID parameter', () => {
    render(
      <MemoryRouter initialEntries={['/lobby?id=test-lobby-123']}>
        <LobbyPage />
      </MemoryRouter>
    )
    expect(screen.getByText(/Lobby test-lobby-123/i)).toBeInTheDocument()
  })

  it('redirects to landing when lobby has no ID', () => {
    // This would require more complex test setup with Router provider
    // Will be tested in integration tests
  })
})
```

## URL Structure

### Landing Page
```
/
```

### Lobby Page
```
/lobby?id={lobbyId}

Example:
/lobby?id=550e8400-e29b-41d4-a716-446655440000
```

### Game Page
```
/game?id={lobbyId}

Example:
/game?id=550e8400-e29b-41d4-a716-446655440000

Note: gameId is same as lobbyId (the lobby room becomes the game room)
```

## Navigation Flow

```
Landing Page
    |
    +---> Create Lobby → API call → navigate to /lobby?id={lobbyId}
    |
    +---> Join Lobby → API call → navigate to /lobby?id={lobbyId}

Lobby Page
    |
    +---> Leader clicks "Begin Game" → API call → navigate to /game?id={lobbyId}
    |
    +---> WebSocket event "lobby:gameStarting" → navigate to /game?id={lobbyId}
    |
    +---> Back button → navigate to /

Game Page
    |
    +---> Game ends → navigate to /
    |
    +---> Player leaves → navigate to /
```

## Output Files

- `/frontend/src/router.tsx` - Router configuration
- `/frontend/src/pages/LandingPage/index.tsx` - Landing page component
- `/frontend/src/pages/LobbyPage/index.tsx` - Lobby page component
- `/frontend/src/pages/GamePage/index.tsx` - Game page component
- `/frontend/src/pages/ErrorPage/index.tsx` - Error page component
- `/frontend/src/hooks/useNavigation.ts` - Navigation hook
- `/frontend/src/utils/url.ts` - URL utility functions
- `/frontend/src/utils/history.ts` - Browser history utilities

## Next Steps

- Task 3: Implement API client for lobby/game actions
- Task 5: Complete Landing Page implementation
- Task 6: Complete Lobby Page implementation
- Task 7: Complete Game Page implementation

## Notes

- URL parameters are used instead of path parameters for easier link sharing
- All pages check for required URL parameters and redirect if missing
- Browser back/forward buttons work naturally with React Router
- The `useNavigation` hook provides centralized navigation logic
