/**
 * Lobby types for the Hi-Lo card game
 */

import { Player, PlayerId } from './player';

export type LobbyId = string; // UUID

export type LobbyStatus = 'waiting' | 'in_game';

export interface Lobby {
  id: LobbyId;
  players: Map<PlayerId, Player>;
  leaderId: PlayerId;
  status: LobbyStatus;
  createdAt: Date;
}

export interface LobbyState {
  id: LobbyId;
  players: Player[];
  leaderId: PlayerId;
  status: LobbyStatus;
}
