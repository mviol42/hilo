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

/**
 * Action types for the lastAction field
 */
export type GameActionType =
  | 'play_cards' // Cards played to pile
  | 'pickup_pile' // Player picked up pile
  | 'blow_up' // Pile blown (10 or four-of-a-kind)
  | 'select_faceup' // Setup phase: selected face-up cards
  | 'game_started'; // Game transitioned to playing phase

/**
 * Information about the last action that occurred in the game
 */
export interface LastAction {
  type: GameActionType;
  playerId: PlayerId;
  playerName: string;
  cards?: Card[]; // Cards involved in the action
  blowUpReason?: 'ten' | 'four_of_kind'; // If type is 'blow_up'
  pickedUpCount?: number; // If type is 'pickup_pile', number of cards picked up
  timestamp: string; // ISO timestamp
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
  lastAction?: LastAction;
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
      name: string;
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
  winnerName?: string;
  playerNames: { [playerId: string]: string }; // Map of all player IDs to names
  lastAction?: LastAction; // Most recent game action
  turnOrder: PlayerId[]; // Order of player turns (for turn indicator)
}
