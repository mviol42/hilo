# Task 9: Integration and Polish

## Goal

Wire everything together, handle edge cases, polish the UI, and prepare for production.

## Prerequisites

- All previous tasks (1-8) completed

## Integration Checklist

### 1. WebSocket Connection Management

Ensure WebSocket connects/disconnects properly:

Create `src/hooks/useWebSocketConnection.ts`:
```typescript
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { socketManager } from '@/services/socket'
import { usePlayer, useUI } from '@/context'

export function useWebSocketConnection(lobbyId: string | null) {
  const { playerId } = usePlayer()
  const { showToast } = useUI()
  const navigate = useNavigate()

  useEffect(() => {
    if (!lobbyId || !playerId) return

    // Connect to WebSocket
    const socket = socketManager.connect()

    // Join the lobby room
    socketManager.joinLobby(lobbyId, playerId)

    // Store playerId in socket data
    socket.io.opts.extraHeaders = {
      ...socket.io.opts.extraHeaders,
      'x-player-id': playerId,
    }

    // Handle connection status
    const handleConnect = () => {
      console.log('[WebSocket] Connected')
    }

    const handleDisconnect = () => {
      console.log('[WebSocket] Disconnected')
      showToast('Connection lost. Reconnecting...', 'error')
    }

    const handleReconnect = () => {
      console.log('[WebSocket] Reconnected')
      showToast('Reconnected!', 'success')
      // Rejoin the room
      socketManager.joinLobby(lobbyId, playerId)
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('reconnect', handleReconnect)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('reconnect', handleReconnect)
      socketManager.leaveLobby(lobbyId, playerId)
    }
  }, [lobbyId, playerId, showToast])
}
```

### 2. Error Boundary

Create `src/components/ErrorBoundary.tsx`:
```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h1>Something went wrong</h1>
          <p>{this.state.error?.message}</p>
          <button onClick={() => window.location.href = '/'}>
            Return to Home
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
```

Wrap app in error boundary:
```typescript
// src/main.tsx
<ErrorBoundary>
  <AppProviders>
    <App />
  </AppProviders>
</ErrorBoundary>
```

### 3. Environment Configuration

Ensure environment variables are properly configured:

```typescript
// src/config.ts
export const config = {
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  wsUrl: import.meta.env.VITE_WS_URL || 'http://localhost:3000',
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
} as const
```

### 4. Add Global Loading Indicator

Create `src/components/GlobalLoading.tsx`:
```typescript
import { useUI } from '@/context'
import { LoadingSpinner } from './LoadingSpinner'
import './GlobalLoading.css'

export function GlobalLoading() {
  const { isLoading } = useUI()

  if (!isLoading) return null

  return (
    <div className="global-loading-overlay">
      <LoadingSpinner />
    </div>
  )
}
```

Add to App:
```typescript
// src/App.tsx
<>
  <Router />
  <ToastContainer />
  <GlobalLoading />
</>
```

### 5. Mobile Responsiveness

Add responsive meta tag to `index.html`:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
```

Add mobile-specific styles:
```css
/* src/index.css */
@media (max-width: 768px) {
  /* Adjust card sizes for mobile */
  .card-medium {
    width: 50px;
    height: 70px;
    font-size: 1rem;
  }

  /* Make hand scrollable horizontally on mobile */
  .hand-zone .card-list {
    overflow-x: auto;
    overflow-y: hidden;
    flex-direction: row;
  }
}

@media (max-width: 480px) {
  /* Further size reduction for small phones */
  .card-medium {
    width: 40px;
    height: 56px;
    font-size: 0.875rem;
  }
}
```

## Edge Cases to Handle

### 1. Player Refreshes During Game

Store game ID in sessionStorage:
```typescript
// When game starts
sessionStorage.setItem('hilo:currentGame', gameId)

// On page load
const savedGameId = sessionStorage.getItem('hilo:currentGame')
if (savedGameId) {
  // Reconnect to game
}
```

### 2. Lobby Creator Leaves

- Backend should assign new leader
- Frontend handles `lobby:leaderChanged` event
- Update UI to show new leader

### 3. Connection Lost During Turn

- Show reconnecting indicator
- On reconnect, fetch latest game state from server
- Resume from current state

### 4. Invalid Lobby ID in URL

- API returns 404
- Show error message
- Redirect to landing page

### 5. Game Already Started When Joining

- API returns 409 Conflict
- Show "Game already in progress" message
- Could implement spectator mode (optional)

## Performance Optimizations

### 1. Memoize Card Components

```typescript
// src/components/Card/index.tsx
import { memo } from 'react'

export const Card = memo(function Card({ card, ... }: CardProps) {
  // Component implementation
})
```

### 2. Debounce Player Name Input

```typescript
// src/utils/debounce.ts
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return function (...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}
```

### 3. Lazy Load Game Page

```typescript
// src/router.tsx
import { lazy, Suspense } from 'react'

const GamePage = lazy(() => import('@/pages/GamePage'))

// In router
{
  path: '/game',
  element: (
    <Suspense fallback={<LoadingSpinner />}>
      <GamePage />
    </Suspense>
  ),
}
```

## Testing Strategy

### Unit Tests
- Individual component rendering
- Utility functions
- Custom hooks

### Integration Tests
- API client
- WebSocket manager
- Context state updates

### E2E Tests (Optional - using Playwright)
```typescript
// e2e/game-flow.spec.ts
test('complete game flow', async ({ page }) => {
  // Create lobby
  await page.goto('/')
  await page.click('text=Create Lobby')

  // Wait for lobby page
  await page.waitForURL(/\/lobby\?id=/)

  // Start game (as leader)
  await page.click('text=Begin Game')

  // Should navigate to game page
  await page.waitForURL(/\/game\?id=/)
})
```

## Production Build

### 1. Environment Variables

Create `.env.production`:
```bash
VITE_API_URL=https://api.yourdomain.com
VITE_WS_URL=https://api.yourdomain.com
```

### 2. Build Command

```bash
npm run build
```

Outputs to `/frontend/dist`

### 3. Preview Production Build

```bash
npm run preview
```

## Deployment Checklist

- [ ] All environment variables set correctly
- [ ] Build succeeds without errors
- [ ] All tests pass
- [ ] No console errors in production build
- [ ] WebSocket connects to production server
- [ ] HTTPS configured (required for WebSocket over SSL)
- [ ] CORS configured on backend
- [ ] Error tracking set up (e.g., Sentry)
- [ ] Analytics set up (optional)

## Documentation

### 1. Update README

Add to `/frontend/README.md`:
```markdown
# Hi-Lo Frontend

Web-based frontend for the Hi-Lo card game.

## Development

\`\`\`bash
npm install
npm run dev
\`\`\`

## Build

\`\`\`bash
npm run build
\`\`\`

## Test

\`\`\`bash
npm test
\`\`\`

## Environment Variables

- \`VITE_API_URL\` - Backend API URL
- \`VITE_WS_URL\` - WebSocket server URL
```

### 2. Create User Guide

Create `/frontend/docs/USER_GUIDE.md` with:
- How to create a lobby
- How to join a lobby
- Game rules
- Controls
- Troubleshooting

## Accessibility Audit

- [ ] All interactive elements keyboard accessible
- [ ] Focus indicators visible
- [ ] ARIA labels where needed
- [ ] Color contrast meets WCAG AA
- [ ] Screen reader tested
- [ ] Reduced motion preference respected

## Browser Compatibility

Test on:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome (Android)

## Final Polish

### Visual Enhancements
- Add favicon
- Add loading screen with logo
- Smooth page transitions
- Card shuffle animations (optional)
- Sound effects (optional)

### UX Improvements
- Confirmation dialogs for leaving game
- Keyboard shortcuts
- Tutorial overlay for first-time users
- Game history/stats (optional)

## Output Files

- `/frontend/.env.production` - Production environment variables
- `/frontend/src/hooks/useWebSocketConnection.ts` - WebSocket connection hook
- `/frontend/src/components/ErrorBoundary.tsx` - Error boundary component
- `/frontend/src/components/GlobalLoading.tsx` - Global loading indicator
- `/frontend/docs/USER_GUIDE.md` - User documentation

## Success Criteria

✅ Complete game flow works end-to-end:
  - Create lobby → Join lobby → Start game → Play cards → Win game

✅ Real-time updates work:
  - Players see each other join/leave lobby
  - Game state updates in real-time
  - Animations play correctly

✅ Error handling:
  - Network errors handled gracefully
  - Invalid states show appropriate messages
  - WebSocket reconnects automatically

✅ Performance:
  - No lag when selecting cards
  - Smooth animations
  - Fast page loads

✅ Mobile support:
  - Works on phones and tablets
  - Touch interactions smooth
  - Layout adapts to screen size

## Notes

- This task ties everything together
- Focus on user experience and edge cases
- Test thoroughly before considering complete
- Iterate based on user feedback
