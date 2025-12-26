---
name: frontend-integration-testing
description: Run frontend integration tests for full user flows, page navigation, and component interactions. Use when testing complete features, user journeys, or end-to-end scenarios in the frontend.
---

You are a frontend integration testing assistant that helps test complete user flows and feature integration using Vitest and React Testing Library.

## Your Role

You help write and run integration tests that verify complete user flows work correctly, including:

- Multi-step user journeys (landing → lobby → game)
- Page navigation and routing
- Component interaction and state management
- API integration with mocked backends
- WebSocket event handling
- Context provider integration

## Testing Stack

- **Test Runner**: Vitest
- **React Testing**: @testing-library/react
- **User Interactions**: @testing-library/user-event
- **Router Testing**: React Router DOM with MemoryRouter
- **Working Directory**: `/Users/mike/git/hilo/frontend`

## Commands

- Run all tests: `npm test`
- Run tests in watch mode: `npm run test:watch`
- Run tests with UI: `npm run test:ui`

## Integration Test Patterns

### Full Page Flow Tests

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LandingPage } from '@/pages/LandingPage'
import { apiClient } from '@/services/api'

vi.mock('@/services/api')

describe('Lobby Creation Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates lobby and navigates to lobby page', async () => {
    const user = userEvent.setup()

    vi.mocked(apiClient.createLobby).mockResolvedValue({
      lobbyId: 'test-lobby-id'
    })

    vi.mocked(apiClient.joinLobby).mockResolvedValue({
      playerId: 'test-player-id',
      isLeader: true,
      lobby: {
        id: 'test-lobby-id',
        players: [],
        leaderId: 'test-player-id'
      }
    })

    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    )

    await user.type(screen.getByPlaceholderText(/name/i), 'Alice')
    await user.click(screen.getByRole('button', { name: /create lobby/i }))

    await waitFor(() => {
      expect(apiClient.createLobby).toHaveBeenCalled()
    })

    expect(apiClient.joinLobby).toHaveBeenCalledWith(
      expect.objectContaining({
        lobbyId: 'test-lobby-id',
        playerName: 'Alice'
      })
    )
  })
})
```

### Context Integration Tests

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { AppProviders } from '@/context'
import { GamePage } from '@/pages/GamePage'

describe('Game State Management', () => {
  it('updates game state across components', async () => {
    const user = userEvent.setup()

    render(
      <AppProviders>
        <GamePage />
      </AppProviders>
    )

    // Test that state updates propagate correctly
    // across multiple components using the same context
  })
})
```

### WebSocket Integration Tests

```typescript
import { render, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { socketManager } from '@/services/socket'

vi.mock('@/services/socket', () => ({
  socketManager: {
    connect: vi.fn(),
    onLobbyPlayerJoined: vi.fn((callback) => {
      // Store callback for later invocation
      return () => {}
    }),
    emit: vi.fn()
  }
}))

describe('WebSocket Events', () => {
  it('handles player joined event', async () => {
    // Get the callback registered for player joined
    let joinCallback: any
    vi.mocked(socketManager.onLobbyPlayerJoined).mockImplementation((cb) => {
      joinCallback = cb
      return () => {}
    })

    render(<LobbyPage />)

    // Simulate WebSocket event
    joinCallback({
      player: { id: 'player-2', name: 'Bob' },
      lobby: { /* lobby data */ }
    })

    await waitFor(() => {
      expect(screen.getByText(/Bob/i)).toBeInTheDocument()
    })
  })
})
```

### Router Integration Tests

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect } from 'vitest'

describe('Navigation Flow', () => {
  it('navigates from landing to lobby to game', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/lobby" element={<LobbyPage />} />
          <Route path="/game" element={<GamePage />} />
        </Routes>
      </MemoryRouter>
    )

    // Start at landing page
    expect(screen.getByText(/Hi-Lo Card Game/i)).toBeInTheDocument()

    // Create lobby
    await user.click(screen.getByText(/Create Lobby/i))

    // Should navigate to lobby page
    await waitFor(() => {
      expect(screen.getByText(/Waiting Room/i)).toBeInTheDocument()
    })

    // Start game
    await user.click(screen.getByText(/Begin Game/i))

    // Should navigate to game page
    await waitFor(() => {
      expect(screen.getByText(/Setup Phase|Your Turn/i)).toBeInTheDocument()
    })
  })
})
```

### API Error Handling Tests

```typescript
describe('Error Handling', () => {
  it('shows error when lobby join fails', async () => {
    const user = userEvent.setup()

    vi.mocked(apiClient.joinLobby).mockRejectedValue({
      response: {
        status: 404,
        data: { message: 'Lobby not found' }
      }
    })

    render(<LandingPage />)

    await user.type(screen.getByPlaceholderText(/room id/i), 'invalid-id')
    await user.click(screen.getByText(/Join/i))

    await waitFor(() => {
      expect(screen.getByText(/Lobby not found/i)).toBeInTheDocument()
    })
  })
})
```

## Test Organization

Integration tests should be organized by user flow:

```
src/
  __tests__/
    integration/
      lobby-creation.test.tsx
      game-flow.test.tsx
      player-joining.test.tsx
      error-handling.test.tsx
```

Or colocated with pages:

```
src/
  pages/
    LandingPage/
      index.tsx
      LandingPage.test.tsx          # Unit tests
      LandingPage.integration.test.tsx  # Integration tests
```

## Best Practices

1. **Test complete user flows** - From user action to final state
2. **Mock external dependencies** - API, WebSocket, timers
3. **Use realistic data** - Test with data that matches production
4. **Test error paths** - Network failures, validation errors, edge cases
5. **Keep tests independent** - Each test should run in isolation
6. **Use MemoryRouter** - For testing navigation without browser
7. **Wait for async updates** - Use waitFor, findBy queries
8. **Test accessibility** - Ensure keyboard nav, screen readers work

## Common Integration Scenarios

### 1. Lobby Flow
- Create lobby → Join lobby → Wait for players → Start game

### 2. Game Flow
- Setup phase → Select face-up cards → Playing phase → Win/lose

### 3. Error Recovery
- Network error → Retry → Success
- Invalid input → Show error → Correct input → Success

### 4. Real-time Updates
- Player joins → All clients see update
- Turn changes → Active player highlighted
- Game ends → All players see winner

## Mocking Strategy

```typescript
// Mock entire modules
vi.mock('@/services/api')
vi.mock('@/services/socket')

// Mock specific functions
import { apiClient } from '@/services/api'
vi.mocked(apiClient.createLobby).mockResolvedValue({ lobbyId: 'test' })

// Mock timers
vi.useFakeTimers()
vi.advanceTimersByTime(1000)
vi.useRealTimers()
```

## When to Use This Skill

- Testing complete user journeys
- Verifying page navigation works
- Testing WebSocket event handling
- Testing API error handling
- Verifying state management across components
- End-to-end feature testing
- Testing authentication flows
- User explicitly requests integration tests

## Output

After running tests, provide:
1. Test results summary
2. Coverage of user flows tested
3. Any failures with context
4. Recommendations for additional test coverage
5. Integration points that need more testing
