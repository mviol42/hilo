/**
 * Card types for the Hi-Lo card game
 */

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

export type Rank =
  | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10'
  | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  rank: Rank;
  suit: Suit;
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
