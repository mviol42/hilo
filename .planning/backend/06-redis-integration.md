# Task 6: Redis Integration

## Objective

Implement Redis for game state persistence and action logging to support replay, debugging, and potential horizontal scaling.

## Subtasks

### 6.1 Redis Client Setup
- Configure Redis connection (host, port, auth)
- Handle connection errors gracefully
- Implement connection pooling if needed

### 6.2 Game State Persistence
- Store game state on each update
- Key pattern: `game:{gameId}:state`
- TTL for completed games (cleanup)

### 6.3 Action Logging
- Log every game action with timestamp
- Key pattern: `game:{gameId}:log`
- Use Redis List for ordered actions

```typescript
interface GameLogEntry {
  timestamp: Date;
  playerId: string;
  action: 'play' | 'pickup' | 'draw' | 'blowup';
  cards?: Card[];
  resultingState?: string; // State hash or summary
}
```

### 6.4 Lobby State (Optional)
- Store active lobbies in Redis
- Enables multi-server deployment
- Key pattern: `lobby:{lobbyId}`

### 6.5 Session Storage
- Store player ↔ lobby/game mappings
- Enable reconnection across server restarts
- Key pattern: `player:{playerId}:session`

### 6.6 Pub/Sub for Scaling (Future)
- Publish game events to channel
- Subscribe to events for multi-server sync
- Channel pattern: `game:{gameId}:events`

## Acceptance Criteria

- [ ] Game state persists to Redis after each action
- [ ] Complete game log can be retrieved
- [ ] Server can recover game state from Redis
- [ ] Graceful fallback if Redis unavailable
