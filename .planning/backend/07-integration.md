# Task 7: Integration & Testing

## Objective

Wire all components together and ensure the complete system works end-to-end.

## Subtasks

### 7.1 Component Integration
- Connect HTTP routes to Lobby Service
- Connect Socket handlers to Game Engine
- Wire Redis logging into game actions
- Ensure state consistency across all layers

### 7.2 Request Flow Testing
Complete flows to verify:

**Lobby Flow:**
1. Create lobby → Get lobby ID
2. Multiple players join → All receive updates
3. Leader starts game → All transition to game

**Game Flow:**
1. Setup phase → Players select faceUp cards
2. Turn execution → Cards played, state updates
3. Pick up pile → Hand grows, turn passes
4. Blow up pile → Same player continues
5. Win condition → Game ends properly

### 7.3 Error Handling
- Invalid lobby/game IDs
- Playing out of turn
- Playing invalid cards
- Disconnection during game
- Redis connection failure

### 7.4 Edge Cases
- 2-player game
- Large game (8+ players)
- Player leaves mid-game
- All players disconnect
- Rapid consecutive actions

### 7.5 Performance Testing
- Multiple concurrent games
- Many players per game
- Rapid state updates
- Memory leak detection

### 7.6 Logging & Monitoring
- Request logging
- Error tracking
- Game action audit trail
- Performance metrics

### 7.7 Frontend Integration Test
- Serve frontend from Express
- Test complete user journey
- Verify state sync across clients

## Acceptance Criteria

- [ ] Complete game playable through API/WebSocket
- [ ] All error cases return appropriate responses
- [ ] No memory leaks during extended play
- [ ] Frontend successfully integrates with backend
- [ ] Game log accurately records all actions
