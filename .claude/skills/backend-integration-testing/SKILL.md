---
name: backend-integration-testing
description: Run backend integration tests for HTTP API endpoints and WebSocket events. Use when testing full request/response flows, API behavior, Socket.IO events, or end-to-end game scenarios.
---

# Backend Integration Testing

## Commands

```bash
# Run all integration tests
cd backend && npm run test:integration

# Run specific integration test file
cd backend && npm run test:integration -- tests/integration/api/lobby.test.ts

# Run with verbose output
cd backend && npm run test:integration -- --reporter=verbose

# Run all tests (unit + integration)
cd backend && npm run test:all
```

## Test Categories

### HTTP API Tests
Test full request/response cycle using supertest:
- Verify status codes and headers
- Validate response body structure
- Test error responses and edge cases

### WebSocket Tests
Test Socket.IO events using socket.io-client:
- Event emission and reception
- Real-time state broadcasts
- Multi-client scenarios

### End-to-End Game Flow
Test complete user journeys:
- Lobby creation → player join → game start
- Full game from start to winner
- Error recovery and edge cases

## Test File Structure

```
backend/tests/integration/
├── api/
│   ├── lobby.test.ts      # Lobby HTTP endpoints
│   └── game.test.ts       # Game HTTP endpoints
├── websocket/
│   ├── lobbyEvents.test.ts
│   └── gameEvents.test.ts
├── flows/
│   └── fullGame.test.ts   # End-to-end game flow
└── setup.ts               # Test server setup/teardown
```

## Example: HTTP API Test

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestServer } from '../setup';

describe('Lobby API', () => {
  let app: Express;
  let server: Server;

  beforeAll(async () => {
    const testEnv = await createTestServer();
    app = testEnv.app;
    server = testEnv.server;
  });

  afterAll(async () => {
    await server.close();
  });

  describe('POST /api/lobby/create', () => {
    it('should create a new lobby and return lobby ID', async () => {
      const response = await request(app)
        .post('/api/lobby/create')
        .expect(201);

      expect(response.body).toHaveProperty('lobbyId');
      expect(response.body.lobbyId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });
  });
});
```

## Example: WebSocket Test

```typescript
import { io, Socket } from 'socket.io-client';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestServer, TEST_PORT } from '../setup';

describe('Lobby WebSocket Events', () => {
  let socket1: Socket;
  let socket2: Socket;

  beforeAll(async () => {
    await createTestServer();
    socket1 = io(`http://localhost:${TEST_PORT}`);
    socket2 = io(`http://localhost:${TEST_PORT}`);

    await Promise.all([
      new Promise(r => socket1.on('connect', r)),
      new Promise(r => socket2.on('connect', r)),
    ]);
  });

  afterAll(() => {
    socket1.disconnect();
    socket2.disconnect();
  });

  it('should notify when player joins lobby', async () => {
    const lobbyId = 'test-lobby';

    const joinPromise = new Promise((resolve) => {
      socket1.once('lobby:playerJoined', resolve);
    });

    socket1.emit('lobby:join', { lobbyId, playerName: 'Player1' });
    socket2.emit('lobby:join', { lobbyId, playerName: 'Player2' });

    const event = await joinPromise;
    expect(event).toHaveProperty('playerName', 'Player2');
  });
});
```

## WebSocket Testing Subtleties

### Event Timing and Buffering

**Problem**: When multiple events are emitted in rapid succession (e.g., `stateUpdate` → `stateUpdate` → `turnChange`), tests using `waitForEvent()` may receive stale/buffered events instead of the expected ones.

**Example**: After all players select face-up cards:
1. Server emits: `stateUpdate` (after selectFaceUp)
2. Server emits: `stateUpdate` (after startGamePlay)
3. Server emits: `turnChange`

If a test then calls `waitForEvent(socket, 'game:stateUpdate')` to wait for a card play event, it may receive one of the buffered events from setup.

**Solution**: Remove event listeners after setup to prevent stale events:
```typescript
await waitForEvent(socket1, 'game:turnChange'); // Wait for game start

// Remove stateUpdate listeners to prevent receiving buffered events
socket1.removeAllListeners('game:stateUpdate');
socket2.removeAllListeners('game:stateUpdate');
```

### PlayerView vs GameState Structure

**Problem**: Tests may incorrectly access game state properties based on internal `GameState` structure rather than the client-facing `PlayerView` structure.

**Incorrect**:
```typescript
expect(stateUpdate.gameState.players[playerId].hand.length).toBe(3);
```

**Correct** (PlayerView structure):
```typescript
expect(stateUpdate.gameState.myHand.length).toBe(3);
expect(stateUpdate.gameState.otherPlayers[otherPlayerId].handCount).toBe(3);
```

### Error Event Typing

**Problem**: Socket.IO's `error` event must be included in `ServerToClientEvents` for type-safe testing.

**Solution**: Add to `shared/types/events.ts`:
```typescript
export interface ErrorEvent {
  message: string;
}

export interface ServerToClientEvents {
  // ... other events
  'error': (data: ErrorEvent) => void;
}
```

### Test Performance

Keep integration test suite under 5 seconds by:
- Reducing artificial delays (use 20ms instead of 100ms)
- Removing listeners to prevent event buffering
- Using `waitForEvent()` strategically (wait for definitive events like `turnChange`)
- Avoiding unnecessary setup/teardown delays

## Prerequisites

- Test server runs on separate port (default: 3001)
- Redis mock or test instance configured
- Clean state between test suites
- Proper async cleanup in afterAll hooks

## When This Skill Applies

- Testing HTTP endpoint behavior
- Testing WebSocket event flows
- Verifying full game scenarios
- Debugging client-server communication
- Pre-merge validation of features
