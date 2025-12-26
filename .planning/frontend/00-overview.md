# Frontend Implementation Plan

## Overview

This plan outlines the implementation of a web-based frontend for the Hi-Lo card game. The frontend will provide an interactive UI for players to join lobbies, set up games, and play the Hi-Lo card game in real-time.

## Technology Stack

- **Language**: TypeScript (to share types with backend via `@hilo/shared`)
- **Framework**: React with TypeScript
- **Build Tool**: Vite
- **Styling**: CSS Modules or Tailwind CSS
- **HTTP Client**: Axios
- **WebSocket**: Socket.IO Client
- **Routing**: React Router
- **State Management**: React Context + useReducer (or Redux Toolkit if complexity warrants)
- **Testing**: Vitest + React Testing Library

## Architecture Principles

1. **Type Safety**: Leverage shared TypeScript types from `@hilo/shared` for all API interactions
2. **Real-time Updates**: Use WebSocket events for live lobby and game state updates
3. **Command Pattern**: All mutations go through HTTP API; WebSocket is read-only for state updates
4. **Responsive Design**: Mobile-friendly layout with graceful degradation
5. **Browser Persistence**: Store player ID in localStorage for session continuity

## High-Level Tasks

| Task | File | Description | Dependencies |
|------|------|-------------|--------------|
| 1 | [01-project-setup.md](./01-project-setup.md) | Initialize React project with Vite, install dependencies, configure TypeScript | None |
| 2 | [02-routing-navigation.md](./02-routing-navigation.md) | Set up React Router for page navigation and URL parameters | Task 1 |
| 3 | [03-api-client.md](./03-api-client.md) | Create HTTP API client and WebSocket connection manager | Task 1 |
| 4 | [04-state-management.md](./04-state-management.md) | Design and implement global state management | Tasks 1, 3 |
| 5 | [05-landing-page.md](./05-landing-page.md) | Implement landing page with "Create Lobby" and "Join Lobby" | Tasks 2, 3, 4 |
| 6 | [06-lobby-page.md](./06-lobby-page.md) | Implement lobby page with player list, ready system, and game start | Tasks 2, 3, 4 |
| 7 | [07-game-page.md](./07-game-page.md) | Implement game page with card zones, setup phase, and turn play | Tasks 2, 3, 4 |
| 8 | [08-shared-components.md](./08-shared-components.md) | Build reusable components (Card, CardZone, Button, etc.) | Task 1 |
| 9 | [09-integration.md](./09-integration.md) | End-to-end integration, error handling, and polish | Tasks 2-8 |

## Implementation Order

```
Task 1 (Project Setup)
    |
    +---> Task 8 (Shared Components) --+
    |                                   |
    +---> Task 2 (Routing) ------------+
    |                                   |
    +---> Task 3 (API Client) ---------+
    |                                   |
    +---> Task 4 (State Management) ---+
                                        |
                                        +---> Task 5 (Landing Page) --+
                                        |                             |
                                        +---> Task 6 (Lobby Page) ----+
                                        |                             |
                                        +---> Task 7 (Game Page) -----+
                                                                      |
                                                                      +---> Task 9 (Integration)
```

## Key Features by Page

### Landing Page
- Create new lobby button
- Join existing lobby with input field
- Error display for invalid lobby IDs
- Player ID generation and storage

### Lobby Page
- Real-time player list updates via WebSocket
- Copy lobby link button
- Leader-specific "Begin Game" button
- Non-leader "Ready" button
- Visual indication of ready status
- Player name input (persisted to localStorage)

### Game Page - Setup Phase
- Display 6 cards in hand
- 3 empty slots for face-up card selection
- Card selection/deselection interaction
- Confirm button (enabled when 3 cards selected)
- Waiting state while other players select

### Game Page - Playing Phase
- **Hand Zone**: Scrollable card list at bottom (1/10 screen height)
- **Face-up Zone**: Toggle view between hand and face-up cards
- **Pile Zone**: Shared pile visible to all players
- **Other Players**: Display opponent card counts and face-up cards
- **Playable Cards**: Green highlight animation (2s fade in/out)
- **Card Selection**: Multi-select for same-rank cards
- **Submit Button**: Play selected cards
- **Animations**:
  - Bonus play (blue text)
  - Pile blown/exploded (green text)
  - No playable cards (red text)

## API Integration

### HTTP Endpoints Used
- `POST /api/lobby/create` - Create new lobby
- `POST /api/lobby/join` - Join existing lobby
- `POST /api/lobby/ready` - Mark player as ready
- `POST /api/lobby/leave` - Leave lobby
- `POST /api/game/start` - Start game (leader only)
- `POST /api/game/select-faceup` - Select face-up cards (setup phase)
- `POST /api/game/play-cards` - Play cards from hand/face-up/face-down
- `POST /api/game/pickup-pile` - Pick up pile when no playable cards

### WebSocket Events Subscribed
- `lobby:playerJoined` - Player joined lobby
- `lobby:playerLeft` - Player left lobby
- `lobby:playerReadied` - Player marked ready
- `lobby:leaderChanged` - Leader changed (previous leader left)
- `lobby:gameStarting` - Game is starting
- `game:stateUpdate` - Game state changed (personalized PlayerView)
- `game:turnChange` - Active player changed
- `game:pileBlown` - Pile was blown up
- `game:playerWon` - Player won the game
- `error` - Server error occurred

## Data Flow

1. **Page Load**:
   - Check localStorage for existing player ID
   - If none, generate new UUID and store it

2. **Create/Join Lobby**:
   - HTTP POST to create/join endpoint
   - Receive lobby ID and state
   - Navigate to `/lobby?id={lobbyId}`
   - Connect WebSocket and join lobby room

3. **Lobby Updates**:
   - WebSocket events update local lobby state
   - React components re-render with new state

4. **Game Start**:
   - Leader clicks "Begin Game"
   - HTTP POST to `/api/game/start`
   - Receive initial game state (PlayerView)
   - WebSocket emits `lobby:gameStarting` to all players
   - All players navigate to `/game?id={lobbyId}`

5. **Game Play**:
   - Player actions → HTTP POST with card data
   - Server validates and updates game state
   - Server broadcasts personalized `game:stateUpdate` to each player via WebSocket
   - Frontend updates UI with new state

## Browser Storage

### localStorage Keys
- `hilo:playerId` - Player's UUID (persists across sessions)
- `hilo:playerName` - Player's display name (default for next game)

## Responsive Design Considerations

- **Mobile-first**: Design for portrait mobile, scale up to desktop
- **Touch targets**: Minimum 44x44px for all interactive elements
- **Card size**: Scale based on screen width, maintain aspect ratio
- **Scroll zones**: Hand and face-up zones independently scrollable
- **Animations**: Reduce motion preference respected

## Error Handling Strategy

1. **Network Errors**: Show toast notification, retry mechanism
2. **Invalid Lobby**: Display error message under input field (red text)
3. **Game State Errors**: Display modal with error message
4. **WebSocket Disconnect**: Show reconnecting banner, auto-reconnect
5. **Stale State**: Use optimistic updates with rollback on error

## Testing Strategy

- **Unit Tests**: Individual components and utility functions
- **Integration Tests**: API client, WebSocket manager
- **E2E Tests**: Full user flows (create lobby → join → play → win)
- **Visual Regression**: Snapshot tests for UI components

## Performance Considerations

- **Code Splitting**: Lazy load game page (heaviest component)
- **Memoization**: React.memo for card components (frequent re-renders)
- **Debouncing**: Input fields (player name)
- **Virtual Scrolling**: If hand size exceeds reasonable limit (>50 cards)

## Accessibility (a11y)

- **Keyboard Navigation**: All interactions accessible via keyboard
- **Screen Readers**: Proper ARIA labels for game state
- **Color Contrast**: WCAG AA compliance for all text
- **Focus Management**: Clear focus indicators

## Source Documents

- `/docs/frontend-design.md` - Frontend UI/UX specification
- `/docs/game-rules.md` - Complete Hi-Lo card game rules
- `/shared/types/` - Shared TypeScript type definitions
- `/backend/src/routes/` - Backend API endpoint reference
