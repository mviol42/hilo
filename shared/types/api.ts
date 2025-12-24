/**
 * HTTP API request/response types
 */

import { LobbyId, LobbyState } from './lobby';
import { PlayerId } from './player';
import { GameState, PlayerView } from './game';

// Lobby endpoints

export interface CreateLobbyResponse {
  lobbyId: LobbyId;
}

export interface JoinLobbyRequest {
  lobbyId: LobbyId;
  playerName?: string;
}

export interface JoinLobbyResponse {
  playerId: PlayerId;
  isLeader: boolean;
  lobby: LobbyState;
  error?: string;
}

export interface LeaveLobbyRequest {
  lobbyId: LobbyId;
  playerId: PlayerId;
}

export interface LeaveLobbyResponse {
  success: boolean;
  lobby?: LobbyState;
}

export interface StartGameRequest {
  lobbyId: LobbyId;
  playerId: PlayerId;
}

export interface StartGameResponse {
  gameState: PlayerView;
  error?: string;
}

// Error responses

export interface ErrorResponse {
  error: string;
  message?: string;
}
