/**
 * Card types for the Hi-Lo card game
 */

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

export type Rank =
  | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10'
  | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
}

/**
 * Check if two cards are the same card (by unique ID)
 */
export function cardsEqual(a: Card, b: Card): boolean {
  return a.id === b.id;
}

let cardIdCounter = 0;

/**
 * Create a card with an auto-generated unique ID.
 * Useful for tests and creating placeholder cards.
 */
export function createCard(rank: Rank, suit: Suit): Card {
  return {
    id: `${++cardIdCounter}`,
    rank,
    suit,
  };
}

/**
 * Rank ordering for game logic
 * Note: 8 is "invisible" for comparison purposes
 */
export const RANK_ORDER: Rank[] = [
  '2', '3', '4', '5', '6', '7', '9', 'J', 'Q', 'K', 'A'
];

/**
 * Special cards with unique behaviors
 */
export const SPECIAL_RANKS = {
  RESET: '2' as Rank,      // Can be played on anything
  INVISIBLE: '8' as Rank,  // Ignored in rank comparisons
  BLOW_UP: '10' as Rank,   // Removes pile
} as const;

/**
 * Deck creation strategies
 */
export type DeckStrategy = 'standard' | 'quick' | 'mega-explosion';

export const DECK_STRATEGY_LABELS: Record<DeckStrategy, string> = {
  'standard': 'Standard',
  'quick': 'Quick',
  'mega-explosion': 'Mega Explosion'
};
