# Task 5: WebSocket Layer

## Objective

Implement real-time communication using Socket.IO for live game state updates and player synchronization.

## Subtasks

### 5.1 Socket.IO Server Setup
- Integrate with Express server
- Configure CORS for frontend
- Set up connection/disconnection handlers

### 5.2 Room Management
- Players join Socket.IO room matching lobby ID
- Broadcast events to room members only
- Track socket ID ↔ player ID mapping

### 5.3 Lobby Events

**Server → Client:**
- `lobby:playerJoined` - New player joined lobby
- `lobby:playerLeft` - Player left lobby
- `lobby:leaderChanged` - Leader reassigned
- `lobby:gameStarting` - Game is about to start

**Client → Server:**
- `lobby:leave` - Player leaving lobby

### 5.4 Game Events

**Server → Client:**
- `game:stateUpdate` - Full game state after any action
- `game:turnChange` - Active player changed
- `game:pileBlown` - Pile was blown up (visual effect)
- `game:playerWon` - Game ended with winner

**Client → Server:**
- `game:playCards` - Player plays card(s)
- `game:pickUpPile` - Player picks up the pile
- `game:selectFaceUp` - During setup, choose faceUp cards

### 5.5 State Broadcasting
- After every game action, broadcast updated state
- Each player receives their personalized view (hidden cards filtered)
- Include playable cards for active player

### 5.6 Reconnection Handling
- Player reconnects with saved player ID
- Rejoin Socket.IO room
- Send current game state immediately

### 5.7 Spectator Support
- Late joiners can observe ongoing game
- Receive state updates but cannot take actions
- See public information only (pile, faceUp cards)

## Acceptance Criteria

- [ ] All players receive real-time updates
- [ ] Each player sees correct game view
- [ ] Socket disconnection handled gracefully
- [ ] Reconnection restores player to game
