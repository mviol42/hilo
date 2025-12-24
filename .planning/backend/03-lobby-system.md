# Task 3: Lobby System

## Objective

Implement the lobby management service that handles player connections, room state, and transitions to active games.

## Subtasks

### 3.1 Lobby Data Structure
```typescript
interface Lobby {
  id: string;
  players: Map<string, Player>;
  leaderId: string;
  status: 'waiting' | 'in_game';
  createdAt: Date;
}

interface Player {
  id: string;
  name: string;
  isLeader: boolean;
  socketId?: string;
}
```

### 3.2 Lobby Service
- `createLobby(): Lobby` - Create new lobby with UUID
- `joinLobby(lobbyId, playerName): Player` - Add player to lobby
- `leaveLobby(lobbyId, playerId): void` - Remove player from lobby
- `getLobby(lobbyId): Lobby | null` - Retrieve lobby state
- `setLeader(lobbyId, playerId): void` - Reassign leader if current leaves
- `transitionToGame(lobbyId): void` - Mark lobby as in_game

### 3.3 Lobby Storage
- In-memory Map for active lobbies
- Auto-cleanup of stale lobbies (configurable timeout)
- Consider Redis for distributed deployment later

### 3.4 Player Management
- Generate unique player IDs (UUIDs)
- Track socket connections per player
- Handle reconnection scenarios
- Support player name customization

### 3.5 Leader Assignment
- First player to join becomes leader
- If leader leaves, assign to next player
- Only leader can start the game

## Acceptance Criteria

- [ ] Multiple lobbies can exist simultaneously
- [ ] Players can join/leave lobbies
- [ ] Leader is correctly assigned and reassigned
- [ ] Lobby state is retrievable by ID
