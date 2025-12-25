---
name: client-development
description: Client development workflow for Hi-Lo game CLI client. Use when implementing client features, UI, networking, or any client code. Enforces planning, testing, and quality standards before marking features complete.
---

# Client Development Workflow

## Core Principles

Every client feature implementation MUST follow this workflow:
1. **Plan** the implementation approach
2. **Implement** with tests (TDD when appropriate)
3. **Verify** all tests pass
4. **Build** to ensure compilation
5. **Complete** only when all checks pass

**A feature is NOT complete until:**
- ✅ All integration tests pass
- ✅ Code builds successfully
- ✅ HTTP API calls use proper types from `@hilo/shared`
- ✅ WebSocket listeners are read-only (no mutation events)

## Architecture Rules

### WebSockets are READ-ONLY

**CRITICAL**: WebSockets can ONLY be used for receiving server notifications.

✅ **Allowed** (read-only):
```typescript
// Listen for server events
socket.on('game:stateUpdate', (data) => {
  this.state.updateGameState(data.gameState);
});

socket.on('lobby:playerJoined', (data) => {
  this.ui.showLobby(data.lobby);
});
```

❌ **NOT Allowed** (mutations):
```typescript
// ❌ Never emit mutations via WebSocket
socket.emit('game:playCards', { cards });  // WRONG!
socket.emit('lobby:join', { lobbyId });    // WRONG!
```

✅ **Use HTTP API for all mutations**:
```typescript
// ✅ All mutations via HTTP
await api.playCards(gameId, playerId, cards);
await api.joinLobby(lobbyId, playerName);
await api.startGame(lobbyId, playerId);
```

### HTTP-First Architecture

**Pattern**: HTTP for mutations, WebSocket for notifications

```typescript
// 1. Client mutates state via HTTP
const { gameState } = await api.startGame(lobbyId, playerId);

// 2. Update local state from HTTP response
this.state.startGame(gameState.id);
this.state.updateGameState(gameState);

// 3. Server broadcasts WebSocket notifications to all players
// (Clients listen but don't send mutations)
```

## Development Workflow

### Step 1: Plan the Implementation

Before writing code, create a plan that includes:

**For new features:**
- What user interaction triggers this?
- What HTTP API calls are needed?
- What WebSocket events should be listened to?
- What types from `@hilo/shared` will be used?
- How will the UI respond?
- How will this be tested?

**For bug fixes:**
- What is the root cause?
- What test can reproduce the bug?
- What is the minimal fix?

**Example planning questions:**
```
Q: What API endpoint will this call?
Q: What types will I use from @hilo/shared?
Q: What WebSocket events should I listen for?
Q: What UI updates are needed?
Q: How will I test this?
```

### Step 2: Implement with Tests

**Integration Tests** (`tests/integration/`) for:
- HTTP API client methods
- WebSocket event listeners
- End-to-end user flows

Example test structure:
```typescript
// tests/integration/api.test.ts
describe('ApiClient', () => {
  it('should start game and receive state', async () => {
    const { gameState } = await api.startGame(lobbyId, playerId);
    expect(gameState).toBeDefined();
    expect(gameState.phase).toBe('setup');
  });
});
```

### Step 3: Run All Tests

Before considering a feature complete:

```bash
# Run all tests
cd client && npm test

# Watch mode during development
cd client && npm run test:watch
```

**All tests MUST pass.** If any fail:
- Fix the failing tests
- Do NOT skip or comment out tests
- Do NOT mark feature as complete

### Step 4: Build Verification

Ensure the code compiles:

```bash
cd client && npm run build
```

**The build MUST succeed.** If it fails:
- Fix TypeScript compilation errors
- Ensure all imports are correct
- Verify shared types are accessible from `@hilo/shared`

## Code Organization

```
client/src/
├── api.ts           # HTTP API client (mutations)
├── socket.ts        # WebSocket client (notifications only)
├── client.ts        # Main game client orchestration
├── gameState.ts     # Local state management
├── ui.ts            # Console UI rendering
├── input.ts         # User input handling
└── logger.ts        # Logging utilities
```

### File Responsibilities

**api.ts (HTTP Client)**:
- ALL mutations (create, join, leave, start, play, pickup, select)
- Returns typed responses from `@hilo/shared`
- Handles HTTP errors

**socket.ts (WebSocket Client)**:
- ONLY listens for server events (read-only)
- No mutation events emitted
- Provides `.on()`, `.once()`, `.off()` methods
- Manages connection lifecycle

**client.ts (Orchestration)**:
- Coordinates API calls and WebSocket listeners
- Manages game flow and user interaction
- Updates UI based on state changes

## Type Safety

### Use Shared Types

✅ **Always import from `@hilo/shared`**:
```typescript
import {
  LobbyId,
  PlayerId,
  PlayerView,
  Card,
  LobbyState
} from '@hilo/shared';
```

✅ **Use typed API responses**:
```typescript
// api.ts
async startGame(lobbyId: LobbyId, playerId: PlayerId): Promise<{ gameState: PlayerView }> {
  const response = await this.axios.post<{ gameState: PlayerView }>('/api/game/start', {
    lobbyId,
    playerId,
  });
  return response.data;
}
```

✅ **Type WebSocket events**:
```typescript
import { ServerToClientEvents } from '@hilo/shared';

socket.on<K extends keyof ServerToClientEvents>(
  event: K,
  listener: ServerToClientEvents[K]
): void {
  this.socket.on(event, listener as any);
}
```

## Testing Guidelines

### Integration Test Requirements

**Every HTTP API method needs tests:**
```typescript
// tests/integration/api.test.ts
describe('ApiClient', () => {
  describe('Lobby Management', () => {
    it('should create lobby', async () => {
      const { lobbyId } = await api.createLobby();
      expect(lobbyId).toBeDefined();
    });

    it('should join lobby', async () => {
      const response = await api.joinLobby(lobbyId, 'Player1');
      expect(response.playerId).toBeDefined();
      expect(response.isLeader).toBe(true);
    });
  });
});
```

**WebSocket listeners should be tested**:
```typescript
// tests/integration/socket.test.ts
describe('SocketClient', () => {
  it('should connect to server', async () => {
    await expect(socket.connect()).resolves.not.toThrow();
  });

  it('should receive game state updates', async () => {
    const stateUpdate = await new Promise((resolve) => {
      socket.on('game:stateUpdate', (data) => resolve(data));
      // Trigger update via HTTP API
      api.playCards(gameId, playerId, cards);
    });
    expect(stateUpdate).toBeDefined();
  });
});
```

## Definition of Done Checklist

A task is complete when ALL of these are true:

```
☐ Code plan documented (approach, types, tests)
☐ Implementation follows TypeScript best practices
☐ HTTP API used for ALL mutations (no WebSocket mutations)
☐ WebSocket only used for read-only notifications
☐ Integration tests written and passing
☐ All existing tests still pass
☐ Build succeeds without TypeScript errors
☐ Shared types imported from @hilo/shared
☐ Error handling implemented for API calls
☐ UI updates properly on state changes
```

## Common Commands

```bash
# Development
cd client && npm run dev              # Run client in watch mode

# Testing
cd client && npm test                 # Run all tests
cd client && npm run test:watch       # Tests in watch mode
cd client && npm run test:coverage    # Coverage report

# Build
cd client && npm run build            # Verify TypeScript compilation
cd client && npm start                # Run built client

# From project root
npm run build                         # Build shared + backend + client
```

## Common Patterns

### Making an HTTP API Call

```typescript
// 1. Add method to api.ts
async playCards(
  gameId: string,
  playerId: PlayerId,
  cards: Card[]
): Promise<{ gameState: PlayerView; blowUp: boolean; winner: boolean }> {
  const response = await this.axios.post('/api/game/play-cards', {
    gameId,
    playerId,
    cards,
  });
  return response.data;
}

// 2. Call from client.ts
const result = await this.api.playCards(gameId, playerId, selectedCards);

// 3. Update local state from HTTP response
this.state.updateGameState(result.gameState);
```

### Listening for WebSocket Events

```typescript
// socket.ts - provide typed listener method
on<K extends keyof ServerToClientEvents>(
  event: K,
  listener: ServerToClientEvents[K]
): void {
  this.socket.on(event, listener as any);
}

// client.ts - listen for notifications
this.socket.on('game:stateUpdate', (data) => {
  this.state.updateGameState(data.gameState);
  this.ui.showGameState(data.gameState, this.state.playerId);
});

this.socket.on('lobby:playerJoined', (data) => {
  this.state.updateLobby(data.lobby);
  this.ui.success(`${data.player.name} joined!`);
});
```

### Error Handling

```typescript
// Wrap API calls in try-catch
try {
  const { gameState } = await this.api.startGame(lobbyId, playerId);
  this.ui.success('Game started!');
  this.state.startGame(gameState.id);
} catch (error) {
  if (error instanceof Error) {
    this.ui.error(`Failed to start game: ${error.message}`);
  }
}
```

## When to Use This Skill

This skill applies when:
- Implementing new client features
- Adding HTTP API client methods
- Setting up WebSocket event listeners
- Updating UI components
- Fixing bugs in client code
- Modifying game flow logic
- Any client code changes

## Anti-Patterns to Avoid

❌ **Don't:**
- Emit WebSocket events for mutations
- Skip writing tests for API methods
- Use `any` types everywhere
- Ignore build errors
- Mark features complete with failing tests
- Hardcode values that should come from shared types

✅ **Do:**
- Use HTTP API for ALL mutations
- Use WebSocket ONLY for notifications
- Write tests for all API methods
- Use proper types from `@hilo/shared`
- Handle API errors gracefully
- Update UI based on state changes
- Verify builds succeed

## Examples

### Example: Adding a New Game Action

**Step 1: Plan**
```
Feature: Pick up pile action
API: POST /api/game/pickup-pile
Types: PickUpPileRequest, PickUpPileResponse from @hilo/shared
WebSocket: Listen for game:stateUpdate notification
UI: Show "Picking up pile..." message
Tests: Integration test for API call
```

**Step 2: Add API method**
```typescript
// src/api.ts
async pickUpPile(gameId: string, playerId: PlayerId): Promise<{ gameState: PlayerView }> {
  const response = await this.axios.post<{ gameState: PlayerView }>('/api/game/pickup-pile', {
    gameId,
    playerId,
  });
  return response.data;
}
```

**Step 3: Use in client**
```typescript
// src/client.ts
if (command === 'pickup') {
  try {
    const { gameState } = await this.api.pickUpPile(gameId, playerId);
    this.state.updateGameState(gameState);
    this.ui.info('Picked up the pile');
  } catch (error) {
    this.ui.error('Failed to pick up pile');
  }
}
```

**Step 4: Write test**
```typescript
// tests/integration/api.test.ts
it('should pick up pile', async () => {
  // Setup: create game, join players, start game
  const response = await api.pickUpPile(gameId, playerId);
  expect(response.gameState).toBeDefined();
});
```

**Step 5: Verify**
```bash
npm test        # Should pass
npm run build   # Should succeed
```

**Step 6: Mark complete** ✅

This workflow ensures high-quality, well-tested client code for the Hi-Lo game.