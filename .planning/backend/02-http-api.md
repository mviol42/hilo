# Task 2: HTTP API

## Objective

Implement the REST API endpoints for lobby management and game initialization.

## Subtasks

### 2.1 POST /api/lobby/create
- Generate UUID for new lobby
- Initialize empty lobby state
- Return lobby ID

**Request**: (empty body)
**Response**: `{ lobbyId: string }`

### 2.2 POST /api/lobby/join
- Validate lobby exists
- Generate player UUID
- Add player to lobby
- First player becomes LEADER
- Return player ID and lobby state

**Request**: `{ lobbyId: string, playerName?: string }`
**Response**: `{ playerId: string, isLeader: boolean, players: Player[], error?: string }`

### 2.3 POST /api/game/start
- Validate request is from LEADER
- Validate minimum players (2+)
- Initialize game state from lobby
- Trigger Setup Phase
- Return initial game state

**Request**: `{ lobbyId: string, playerId: string }`
**Response**: `{ gameState: GameState, error?: string }`

### 2.4 Error Handling Middleware
- Invalid lobby ID → 404
- Lobby already in game → 409 (with spectator option)
- Invalid player ID → 401
- Not the leader → 403

## Acceptance Criteria

- [ ] All endpoints return proper JSON responses
- [ ] Error responses include meaningful error messages
- [ ] Request validation with proper status codes
- [ ] CORS configured for frontend origin
