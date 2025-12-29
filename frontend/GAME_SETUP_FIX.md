# Game Setup Flow Fix

## Problem

When the game started, Player 2 would get stuck on "Loading game..." screen after Player 1 selected their face-up cards during the setup phase. Player 2 never received a prompt to select their cards.

## Root Cause

The issue occurred because:

1. **Leader (Player 1)** receives the initial game state from the API response when calling `startGame()`
2. **Non-leaders (Player 2+)** only receive a `lobby:gameStarting` WebSocket event that navigates them to the game page
3. The GameContext WebSocket listeners had a guard that would return early if the socket wasn't connected yet
4. Non-leader players would navigate to the game page but wouldn't have the game state set, causing them to be stuck on the loading screen

## Solution

### 1. Improved WebSocket Listener Setup (`GameContext.tsx`)

Changed the WebSocket listener setup to **retry** if the socket isn't connected yet, instead of silently failing:

```typescript
// Before:
if (!socketManager.isConnected()) {
  return  // Silent failure!
}

// After:
const setupListeners = () => {
  if (!socketManager.isConnected()) {
    console.log('[GameContext] Socket not connected, waiting...')
    const timeout = setTimeout(setupListeners, 100)  // Retry
    return () => clearTimeout(timeout)
  }
  // ... setup listeners
}
```

This ensures that even if the component mounts before the WebSocket is fully connected, the listeners will eventually be set up.

### 2. Added Debug Logging

Added console.log statements throughout to help diagnose issues:

- When GameContext sets up/tears down listeners
- When game state updates are received
- When the GamePage is waiting for state vs rendering

### 3. Better Loading State (`GamePage.tsx`)

Improved the loading screen to show more helpful information:

```typescript
if (!gameState) {
  console.log('[GamePage] Waiting for game state, gameId:', gameId)
  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Loading game...</h1>
        <p className="text-gray-400 mb-4">Waiting for game state from server</p>
        <p className="text-sm text-gray-500">Game ID: {gameId.substring(0, 8)}...</p>
      </div>
    </div>
  )
}
```

## Integration Test

Created comprehensive integration test (`game-setup-flow.test.tsx`) that covers:

1. **Leader flow**: Leader starts game and receives initial state
2. **Non-leader flow**: Non-leader navigates to game page and waits for WebSocket state
3. **Turn transitions**: Player 2 transitions from waiting to their turn after Player 1 selects cards

## Testing

To verify the fix works:

1. Open two browser windows (or use incognito mode for the second)
2. Player 1: Create a lobby
3. Player 2: Join the lobby using the invite link
4. Player 2: Click "Ready"
5. Player 1: Click "Begin Game"
6. Player 1: Select 3 face-up cards and click "Confirm Selection"
7. **Expected**: Player 2 should see "Waiting for other players..." then transition to their setup phase
8. **Previous bug**: Player 2 would be stuck on "Loading game..." indefinitely

## Files Changed

- `/Users/mike/git/hilo/frontend/src/context/GameContext.tsx` - Retry logic for WebSocket listeners
- `/Users/mike/git/hilo/frontend/src/pages/GamePage/index.tsx` - Better loading state and logging
- `/Users/mike/git/hilo/frontend/src/pages/LobbyPage/index.tsx` - Added logging
- `/Users/mike/git/hilo/frontend/src/__tests__/integration/game-setup-flow.test.tsx` - New integration test

## Backend Dependency

This fix assumes the backend properly sends `game:stateUpdate` WebSocket events to all players when the game starts and when turns change. If the backend doesn't send these events, players will still be stuck on the loading screen.

To debug backend issues, check the browser console for:
- `[GameContext] Setting up game event listeners` - Listeners are ready
- `[GameContext] Received game state update: setup` - Game state received
- `[GamePage] Waiting for game state, gameId: ...` - Still waiting (backend issue)
