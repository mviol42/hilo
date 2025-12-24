# Quick Start Guide - Hi-Lo Card Game

This guide will help you get the Hi-Lo card game up and running quickly and test the complete flow.

## Prerequisites

- Node.js (v16 or higher)
- Redis server running on localhost:6379
- Multiple terminal windows (for testing with multiple players)

## Quick Setup

```bash
# 1. Install all dependencies
npm install

# 2. Build all packages
npm run build

# 3. Start the backend server (Terminal 1)
cd backend
npm run dev
```

The server should start successfully and show:
```
[Redis] Connected successfully
Hi-Lo server running on port 3000
```

## Playing the Game

### Testing with 2 Players

#### Player 1 (Terminal 2)

```bash
cd client
npm start
```

1. Enter your name (e.g., "Alice")
2. Choose option 1: "Create a new lobby"
3. Note the Lobby ID displayed (e.g., `abc123...`)
4. Wait for Player 2 to join

#### Player 2 (Terminal 3)

```bash
cd client
npm start
```

1. Enter your name (e.g., "Bob")
2. Choose option 2: "Join an existing lobby"
3. Enter the Lobby ID from Player 1
4. Wait for the game to start

#### Starting the Game (Player 1)

Back in Terminal 2 (Player 1):
1. Type `start` to begin the game
2. The game will transition to the setup phase

### Setup Phase

Each player will:
1. See their 6-card hand
2. Select 3 cards to place face-up
3. Enter indices separated by spaces (e.g., `0 1 2`)

Example:
```
Select 3 cards to place face-up:
  0: [7♥]
  1: [3♠]
  2: [K♦]
  3: [9♣]
  4: [5♥]
  5: [A♠]

Your selection: 0 2 5
```

### Playing Phase

When it's your turn:

**Option 1: Play cards**
```
Command (play/pickup): play

Available cards:
  0: [7♥]
  1: [3♠]
  2: [K♦]

Select card(s) to play: 0
```

**Option 2: Pick up pile** (when you can't play)
```
Command (play/pickup): pickup
```

### Game Rules Summary

- **Card Priority**: Play from Hand → Face-Up → Face-Down
- **Valid Plays**: Card must be ≥ pile top card's rank
- **Special Cards**:
  - **2**: Can play on anything (reset)
  - **7**: Next play must be ≤7
  - **8**: Invisible (ignored in comparisons)
  - **10**: Blows up the pile
  - **4-of-a-kind**: Blows up the pile

### Winning

First player to get rid of all cards (hand, face-up, face-down) wins!

## Example Game Flow

```
Terminal 2 (Alice - Leader):
> Enter your name: Alice
> Choose option: 1
> Lobby created! ID: abc123...
> [Bob joins]
> Command: start
> [Setup phase - select face-up cards]
> [Play cards on your turn]

Terminal 3 (Bob):
> Enter your name: Bob
> Choose option: 2
> Enter lobby ID: abc123...
> [Wait for Alice to start]
> [Setup phase - select face-up cards]
> [Play cards on your turn]
```

## Troubleshooting

### Server not connecting
- Ensure Redis is running: `redis-cli ping` should return `PONG`
- Check backend is running on port 3000
- Verify no firewall blocking localhost:3000

### Client errors
- Rebuild the client: `cd client && npm run build`
- Check you're in the client directory when running
- Ensure backend server started successfully

### Game not starting
- Need at least 2 players in lobby
- Only the leader (first player) can start the game
- Type `start` exactly (lowercase)

## Advanced Testing

### Testing with 3+ Players

Open additional terminals and repeat the "Player 2" steps:
```bash
# Terminal 4 (Player 3)
cd client
npm start
# Join the same lobby ID

# Terminal 5 (Player 4)
cd client
npm start
# Join the same lobby ID
```

The game supports 2-6 players.

### Environment Variables

**Backend**:
```bash
PORT=4000 npm run dev          # Change server port
REDIS_URL=redis://localhost:6380  # Change Redis URL
REDIS_ENABLED=false           # Disable Redis (testing only)
```

**Client**:
```bash
SERVER_URL=http://localhost:4000 npm start  # Connect to different server
```

## Next Steps

- Review [`client/README.md`](client/README.md) for detailed client documentation
- Review [`backend/README.md`](backend/README.md) for backend API documentation
- Check `.planning/backend/` for implementation details
- Run tests: `cd backend && npm run test:all`

Enjoy playing Hi-Lo! 🎮
