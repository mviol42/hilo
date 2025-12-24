/**
 * Player types for the Hi-Lo card game
 */

export type PlayerId = string; // UUID

export interface Player {
  id: PlayerId;
  name: string;
  isLeader: boolean;
  socketId?: string;
}

export interface PlayerGameState {
  hand: import('./card').Card[];
  faceUp: import('./card').Card[];
  faceDown: import('./card').Card[]; // Hidden from player
}
