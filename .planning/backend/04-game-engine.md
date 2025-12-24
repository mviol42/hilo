# Task 4: Game Engine

## Objective

Implement the complete Hi-Lo card game logic including deck management, game phases, turn mechanics, and win conditions.

## Subtasks

### 4.1 Card & Deck Management
- Define Card type (Rank, Suit)
- `createDeck(): Card[]` - Standard 52-card deck (no jokers)
- `shuffleDeck(deck): Card[]` - Fisher-Yates shuffle
- Calculate deck count: 1 deck per 4 players

### 4.2 Game State Structure
```typescript
interface GameState {
  id: string;
  phase: 'setup' | 'playing' | 'ended';
  players: Map<string, PlayerGameState>;
  deck: Card[];
  pile: Card[];
  discardPile: Card[];
  activePlayerId: string;
  turnOrder: string[];
  log: GameAction[];
  winner?: string;
}

interface PlayerGameState {
  hand: Card[];
  faceUp: Card[];
  faceDown: Card[];  // Server knows, not revealed to player
}
```

### 4.3 Setup Phase (Mulligan)
- Deal 9 cards to each player
- Assign 3 cards as faceDown (hidden)
- Player selects 3 cards for faceUp
- Remaining 3 go to hand
- First turn determination (lowest non-special card)

### 4.4 Card Playability Rules
- `isPlayable(card, pile): boolean`
- Special cards: 2 (reset), 8 (invisible), 10 (blow up)
- Compare against top non-8 card on pile
- 7 or lower: next card must be ≤ 7
- Normal: next card must be ≥ current

### 4.5 Turn Execution
- `playCards(playerId, cards): GameState`
- Validate it's player's turn
- Validate cards are playable
- Move cards from hand/faceUp/faceDown to pile
- Check blow-up conditions (10 or 4-of-a-kind)
- Execute post-play phase

### 4.6 Post-Play Phase
- Draw cards to replenish hand to 3 (if deck has cards)
- Check win condition
- Handle blown pile (same player goes again)
- Advance to next player

### 4.7 Pick Up Pile
- `pickUpPile(playerId): GameState`
- When no playable cards in hand
- Move entire pile to player's hand

### 4.8 Win Condition
- Player has no cards in hand, faceUp, or faceDown
- Mark player as winner
- Transition to 'ended' phase

### 4.9 View Generation
- `getPlayerView(gameState, playerId): PlayerView`
- Hide other players' hands
- Hide all faceDown cards
- Include playable card hints for active player

## Acceptance Criteria

- [ ] Complete game can be played from start to finish
- [ ] All card rules correctly implemented
- [ ] Edge cases handled (empty pile, blown pile, etc.)
- [ ] Game state is consistent after every action
