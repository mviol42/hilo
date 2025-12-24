# 05-WebSockets Layer Implementation Plan

## Overview
Implement Socket.IO event handlers for real-time lobby and game functionality with comprehensive integration testing.

## Technologies
- **Socket.IO Server**: 4.6.1 (already installed)
- **Socket.IO Client**: 4.6.1 (for testing, already installed)
- **Test Framework**: Vitest 1.2.1 (already configured)
- **Types**: All event types from `@hilo/shared/types/events.ts`

## Architecture

### Event Handlers Structure
```
backend/src/handlers/
├── lobbyHandlers.ts    # Lobby-related Socket.IO events
├── gameHandlers.ts     # Game-related Socket.IO events
└── index.ts            # Export all handlers
```

### Room Management
- Each lobby gets a Socket.IO room with ID matching `lobbyId`
- Players join room on `lobby:join` event
- Players leave room on `lobby:leave` event or `disconnect`
- All broadcasts go to room: `io.to(lobbyId).emit(...)`

### Socket ID Tracking
- Update player's `socketId` using `lobbyService.updateSocketId()`
- Enables reconnection handling
- Socket data stores: `socket.data.playerId` and `socket.data.lobbyId`

## Event Handlers to Implement

### 1. Lobby Handlers (lobbyHandlers.ts)

#### Client → Server Events

**`lobby:join`**
- Input: `LobbyJoinEvent { lobbyId, playerName? }`
- Logic:
  1. Call `lobbyService.joinLobby(lobbyId, playerName)`
  2. Update socket ID: `lobbyService.updateSocketId(lobbyId, playerId, socket.id)`
  3. Join Socket.IO room: `socket.join(lobbyId)`
  4. Store in socket data: `socket.data = { playerId, lobbyId }`
  5. Emit to room: `lobby:playerJoined` with player and lobby state
  6. Return player info to joining socket
- Error cases: Lobby not found, lobby in game

**`lobby:leave`**
- Input: `{ lobbyId, playerId }`
- Logic:
  1. Call `lobbyService.leaveLobby(lobbyId, playerId)`
  2. Leave Socket.IO room: `socket.leave(lobbyId)`
  3. Clear socket data
  4. If lobby still exists and leader changed:
     - Emit `lobby:leaderChanged` to room
  5. Emit `lobby:playerLeft` to remaining players
- Error cases: Lobby not found, player not in lobby

**`disconnect`**
- Logic:
  1. Get `playerId` and `lobbyId` from `socket.data`
  2. If exists, call `lobby:leave` logic
  3. Handle gracefully if lobby already removed

#### Server → Client Events

**`lobby:playerJoined`**
- Data: `LobbyPlayerJoinedEvent { player, lobby }`
- Broadcast to: All players in lobby room

**`lobby:playerLeft`**
- Data: `LobbyPlayerLeftEvent { playerId, lobby }`
- Broadcast to: Remaining players in lobby room

**`lobby:leaderChanged`**
- Data: `LobbyLeaderChangedEvent { newLeaderId, lobby }`
- Broadcast to: All players in lobby room

**`lobby:gameStarting`**
- Data: `LobbyGameStartingEvent { gameId }`
- Broadcast to: All players in lobby room
- Triggered by HTTP API when game starts

### 2. Game Handlers (gameHandlers.ts)

Need to create a game state service/manager first, or integrate with existing gameEngine.

#### Game State Management
- Store active games in memory: `Map<gameId, GameState>`
- Create `GameService` singleton (similar to `LobbyService`)
- Methods:
  - `createGame(lobbyId, playerIds): GameState`
  - `getGame(gameId): GameState | null`
  - `updateGame(gameId, gameState): void`
  - `removeGame(gameId): void`
  - `getPlayerView(gameId, playerId): PlayerView`

#### Client → Server Events

**`game:selectFaceUp`**
- Input: `GameSelectFaceUpEvent { gameId, playerId, cards }`
- Logic:
  1. Get game state
  2. Validate it's setup phase
  3. Call `selectFaceUpCards()` from game engine
  4. Update game state
  5. Check if all players selected (transition to playing)
  6. Broadcast `game:stateUpdate` to all players with personalized views
  7. If phase changed, broadcast `game:turnChange`
- Error cases: Not setup phase, invalid cards, wrong player

**`game:playCards`**
- Input: `GamePlayCardsEvent { gameId, playerId, cards }`
- Logic:
  1. Get game state
  2. Validate active player
  3. Call `playCards()` from game engine
  4. Update game state
  5. Check for blow-up → emit `game:pileBlown`
  6. Check for winner → emit `game:playerWon`
  7. Broadcast `game:stateUpdate` to all players
  8. Broadcast `game:turnChange` if turn changed
- Error cases: Not player's turn, invalid cards, not playable

**`game:pickUpPile`**
- Input: `GamePickUpPileEvent { gameId, playerId }`
- Logic:
  1. Get game state
  2. Validate active player
  3. Call `pickupPile()` from game engine
  4. Update game state
  5. Broadcast `game:stateUpdate` to all players
  6. Broadcast `game:turnChange`
- Error cases: Not player's turn, has playable cards

#### Server → Client Events

**`game:stateUpdate`**
- Data: `GameStateUpdateEvent { gameState: PlayerView }`
- Send to: Each player individually with personalized PlayerView
- When: After every game action (selectFaceUp, playCards, pickUpPile)

**`game:turnChange`**
- Data: `GameTurnChangeEvent { activePlayerId }`
- Broadcast to: All players in game
- When: Active player changes

**`game:pileBlown`**
- Data: `GamePileBlownEvent { playerId, reason }`
- Broadcast to: All players in game
- When: Pile is blown up (10 or four of a kind)

**`game:playerWon`**
- Data: `GamePlayerWonEvent { winnerId, winnerName }`
- Broadcast to: All players in game
- When: Player has no cards left

### 3. Error Handling

**Global error handler for Socket.IO**
- Wrap all event handlers in try-catch
- Emit `error` event to socket on caught error
- Log errors server-side

**Error event format:**
```typescript
socket.emit('error', { message: string, code?: string })
```

## Testing Strategy

### Integration Tests Structure
```
backend/tests/integration/websocket/
├── connection.test.ts       # Connection/disconnection
├── lobby.test.ts           # Lobby events
├── game-setup.test.ts      # Game setup phase
├── game-play.test.ts       # Game playing phase
└── reconnection.test.ts    # Reconnection handling
```

### Test Utilities
- Extend `tests/integration/setup.ts` with WebSocket helpers
- Helper functions:
  - `createSocketClient(port): Promise<Socket>`
  - `waitForEvent(socket, eventName): Promise<data>`
  - `disconnectSocket(socket): Promise<void>`
  - `joinLobby(socket, lobbyId, playerName?): Promise<player>`

### Test Coverage

**connection.test.ts**
- ✓ Client can connect to server
- ✓ Client receives connection confirmation
- ✓ Client can disconnect gracefully

**lobby.test.ts**
- ✓ Player can join lobby
- ✓ Other players receive playerJoined event
- ✓ Player can leave lobby
- ✓ Other players receive playerLeft event
- ✓ Leader changes when leader leaves
- ✓ Other players receive leaderChanged event
- ✓ Cannot join non-existent lobby
- ✓ Cannot join in-game lobby
- ✓ Disconnect triggers leave logic

**game-setup.test.ts**
- ✓ Players receive gameStarting event
- ✓ Players receive initial game state
- ✓ Player can select face-up cards
- ✓ All players notified of state update
- ✓ Game transitions to playing when all selected
- ✓ Cannot select invalid cards

**game-play.test.ts**
- ✓ Active player can play cards
- ✓ All players receive state update
- ✓ Turn changes to next player
- ✓ Pile blown event emitted on 10 or four of a kind
- ✓ Player can pick up pile when no playable cards
- ✓ Player won event emitted when player finishes
- ✓ Cannot play out of turn
- ✓ Cannot play invalid cards

**reconnection.test.ts**
- ✓ Player can rejoin with same playerId
- ✓ Player receives current game state
- ✓ Socket ID updated on reconnection

## Implementation Order

1. **Create GameService** (`backend/src/services/gameService.ts`)
   - Game state storage
   - CRUD operations
   - PlayerView generation

2. **Implement Lobby Handlers** (`backend/src/handlers/lobbyHandlers.ts`)
   - lobby:join
   - lobby:leave
   - disconnect

3. **Implement Game Handlers** (`backend/src/handlers/gameHandlers.ts`)
   - game:selectFaceUp
   - game:playCards
   - game:pickUpPile

4. **Wire up in server.ts**
   - Import and register all handlers
   - Add error handling middleware

5. **Create Test Utilities** (`backend/tests/integration/websocket/helpers.ts`)
   - Socket client creation
   - Event waiting helpers
   - Lobby joining helpers

6. **Write Integration Tests**
   - Start with connection tests
   - Then lobby tests
   - Then game setup tests
   - Then game play tests
   - Finally reconnection tests

7. **Run All Tests**
   - Ensure unit tests still pass
   - Ensure integration tests pass
   - Run lint

## Types to Use from @hilo/shared

### Event Types (already defined)
- `ClientToServerEvents` - Typed event map for socket.on()
- `ServerToClientEvents` - Typed event map for socket.emit()
- All individual event interfaces

### Type Safety for Socket.IO
```typescript
import { Server, Socket } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents } from '@hilo/shared';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
```

## Edge Cases to Handle

1. **Player disconnects mid-game**
   - Keep game state
   - Allow reconnection with same playerId
   - If timeout, consider player forfeited (future enhancement)

2. **Lobby deleted while players connected**
   - Emit error to all sockets in room
   - Force disconnect or redirect

3. **Multiple sockets for same player**
   - Track most recent socket ID
   - Disconnect old socket when new one joins

4. **Invalid game actions**
   - Validate before processing
   - Return error to socket
   - Don't broadcast invalid state

5. **Race conditions**
   - Use game state as source of truth
   - Validate active player before each action
   - Serialize game actions (handled by single-threaded Node.js)

## Success Criteria

- ✓ All lobby events working (join, leave, leader change)
- ✓ All game events working (select face-up, play cards, pick up pile)
- ✓ State updates sent to all players after each action
- ✓ Personalized PlayerView for each player
- ✓ Error handling for invalid actions
- ✓ Reconnection handling functional
- ✓ All integration tests passing
- ✓ Lint passing
- ✓ Build succeeds

## References

- Socket.IO Official Docs: https://socket.io/docs/v4/testing/
- Testing WebSockets with Vitest: https://medium.com/@juaogui159/how-to-effectively-write-integration-tests-for-websockets-using-vitest-and-socket-io-360208978210
- Integration Testing Best Practices: https://github.com/ITenthusiasm/testing-websockets
