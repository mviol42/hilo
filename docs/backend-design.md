# HILO Backend
* Manages the state for the lobby and game.
* Serves frontend pages over http.
* Connects clients to server with SocketIO.
* Stores the state in Redis. (Game log).
* Implements a game engine.

Constraints:
* Written in typescript, to share common type definitions between frontend and backend.
* Express.js for the backend server
* SocketIO integrated with Express.js for the socket backend.

## Lobby -> Game
There's a state machine to go from lobby to game start, as described in the frontend-design

Create -> Join -> Start, where one player is the leader and the other players join.

## Game
The game proceeds from Setup -> Turn (-> Turn -> Turn -> Turn...) -> End.

At each action, there is an item added to the log for each action, and a "current state" broadcast out.

## Architecture Rule: WebSockets are Read-Only

**RULE: WebSockets are READ ONLY. ALL mutating actions MUST be done through the HTTP API.**

### Rationale

This architectural constraint separates concerns between state mutation and state notification:

- **HTTP API**: Handles all mutations (create, update, delete operations)
  - Provides request/response semantics with explicit success/error handling
  - Enables idempotent operations (safe to retry)
  - Easier to test, secure, and audit
  - Can be load-balanced independently
  - Standard REST patterns apply

- **WebSocket**: Handles all notifications (read-only broadcasts)
  - Pushes state updates to all connected clients
  - Notifies clients of events in real-time
  - Maintains persistent connection for low-latency updates
  - Clients subscribe by joining Socket.IO rooms (lobby/game rooms)

### Implementation Pattern

1. **Client wants to mutate state** (e.g., play cards):
   - Client sends HTTP POST to `/api/game/{gameId}/play-cards`
   - Server validates, mutates state, persists to Redis
   - Server returns HTTP 200/400 response to client
   - Server broadcasts WebSocket `game:stateUpdate` event to all players in the room (including the one who issued the POST request)

2. **Client receives state update**:
   - All clients listening on WebSocket receive `game:stateUpdate`
   - Clients update their local view
   - No acknowledgment required (fire-and-forget notification)

### Enforcement

- Backend MUST reject any WebSocket events that attempt to mutate state
- All mutation event handlers should return error responses
- Client MUST use HTTP API for all mutations
- WebSocket events should only be used for server-to-client broadcasts

### Benefits

- **State Consistency**: Single source of truth for mutations (HTTP API)
- **Scalability**: State mutations can be load-balanced; WebSocket tied to server
- **Security**: Easier to secure and audit HTTP endpoints
- **Testability**: State mutations testable without WebSocket infrastructure
- **Clarity**: Clear separation between commands (HTTP) and events (WebSocket)
