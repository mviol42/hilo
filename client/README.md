# Hi-Lo CLI Client

Command-line interface client for the Hi-Lo card game.

## Installation

```bash
cd client
npm install
npm run build
```

## Usage

### Running the client

```bash
npm run dev
```

Or run the built version:

```bash
npm start
```

Or run directly:

```bash
node dist/index.js
```

### Environment Variables

- `SERVER_URL`: The URL of the backend server (default: `http://localhost:3000`)

Example:
```bash
SERVER_URL=http://localhost:4000 npm start
```

## Game Flow

### 1. Main Menu

When you start the client, you'll be prompted to:
- Enter your player name
- Choose to create a new lobby or join an existing one

### 2. Lobby

#### Creating a Lobby
- Select option 1 from the main menu
- You'll be given a lobby ID to share with other players
- As the lobby leader, you can start the game when ready

#### Joining a Lobby
- Select option 2 from the main menu
- Enter the lobby ID provided by the lobby creator
- Wait for the leader to start the game

#### Lobby Commands
- `start` - Start the game (leader only, requires at least 2 players)
- `leave` - Leave the lobby and return to main menu

### 3. Setup Phase

Once the game starts, each player must:
- Select 3 cards from their 6-card hand to place face-up
- Enter the card indices separated by spaces (e.g., `0 1 2`)

### 4. Playing Phase

During your turn:
- View your cards (hand, face-up, face-down)
- View the pile and other players' visible cards
- Choose an action:
  - `play` - Play one or more cards from your hand/face-up cards
  - `pickup` - Pick up the pile (when you can't play)

#### Playing Cards
- You'll see available cards with their indices
- Enter the indices of cards you want to play (e.g., `0` or `0 1` for multiple)
- Cards must follow Hi-Lo rules (equal or higher rank than pile top)

#### Special Cards
- **2**: Reset card (can be played on anything)
- **7**: Forces next play to be ≤7 or special
- **8**: Invisible card (ignored in comparisons)
- **10**: Blows up the pile immediately
- **4-of-a-kind**: Playing the 4th card of the same rank blows up the pile

### 5. Winning

The first player to get rid of all their cards (hand, face-up, and face-down) wins!

## Card Priority

You must play cards in this order:
1. **Hand** - Play from hand first
2. **Face-Up** - Play from face-up when hand is empty
3. **Face-Down** - Play from face-down when both hand and face-up are empty (blind play)

## UI Features

- Color-coded cards (red for hearts/diamonds, white for clubs/spades)
- Clear visual separation of game phases
- Active player indicator (▶)
- Real-time updates when other players make moves
- Leader indicator (👑)
- Playable cards highlighting

## Testing with Multiple Clients

To test the complete game flow:

1. Start the backend server:
   ```bash
   cd backend
   npm run dev
   ```

2. Open multiple terminal windows and run the client in each:
   ```bash
   cd client
   npm start
   ```

3. In the first terminal:
   - Create a lobby
   - Note the lobby ID

4. In the second terminal:
   - Join the lobby using the ID from step 3

5. In the first terminal (as leader):
   - Type `start` to begin the game

6. Play the game by following the prompts in each terminal

## Troubleshooting

### Connection Errors

If you see connection errors:
- Ensure the backend server is running
- Check that the server URL is correct
- Verify Redis is running (required by backend)

### Invalid Commands

- Make sure you're typing commands exactly as shown (lowercase)
- For card selection, use space-separated indices (e.g., `0 1 2`)
- Commands are context-sensitive (different commands available in lobby vs. game)

## Development

### Running in Development Mode

```bash
npm run dev
```

This uses `ts-node` to run the TypeScript code directly without building.

### Building

```bash
npm run build
```

This compiles the TypeScript code to JavaScript in the `dist/` directory.
