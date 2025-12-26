/**
 * Game state types for the Hi-Lo card game
 */

import { Card } from './card';
import { PlayerId, PlayerGameState } from './player';

export type GamePhase = 'setup' | 'playing' | 'ended';

export type GameAction =
  | 'deal'
  | 'select_faceup'
  | 'play_cards'
  | 'pickup_pile'
  | 'draw_cards'
  | 'blow_up';

export interface GameLogEntry {
  timestamp: Date;
  playerId: PlayerId;
  action: GameAction;
  cards?: Card[];
  description: string;
}

export interface GameState {
  id: string;
  phase: GamePhase;
  players: Map<PlayerId, PlayerGameState>;
  deck: Card[];
  pile: Card[];
  discardPile: Card[];
  activePlayerId: PlayerId;
  turnOrder: PlayerId[];
  log: GameLogEntry[];
  winner?: PlayerId;
}

/**
 * Player view of game state (with hidden information filtered)
 */
export interface PlayerView {
  id: string;
  phase: GamePhase;
  myHand: Card[];
  myFaceUp: Card[];
  myFaceDownCount: number;
  myFaceDownPlayed: boolean[]; // For each facedown slot: true if played, false if unplayed
  otherPlayers: {
    [playerId: string]: {
      handCount: number;
      faceUp: Card[];
      faceDownCount: number;
    };
  };
  pile: Card[];
  deckCount: number;
  activePlayerId: PlayerId;
  playableCards?: Card[]; // Only present if it's this player's turn
  winner?: PlayerId;
}
