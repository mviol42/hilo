/**
 * HTTP API request/response types
 */

import { LobbyId, LobbyState } from './lobby';
import { PlayerId } from './player';
import { GameState, PlayerView } from './game';
import { Card } from './card';

// Lobby endpoints

export interface CreateLobbyResponse {
  lobbyId: LobbyId;
}

export interface JoinLobbyRequest {
  lobbyId: LobbyId;
  playerId: PlayerId;
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

export interface ReadyLobbyRequest {
  lobbyId: LobbyId;
  playerId: PlayerId;
}

export interface ReadyLobbyResponse {
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

// Game action endpoints

export interface SelectFaceUpRequest {
  gameId: string;
  playerId: PlayerId;
  cards: Card[];
}

export interface SelectFaceUpResponse {
  gameState: PlayerView;
}

export interface PlayCardsRequest {
  gameId: string;
  playerId: PlayerId;
  cards: Card[];
  faceDownIndex?: number; // Index for playing facedown cards
}

export interface PlayCardsResponse {
  gameState: PlayerView;
  blowUp: boolean;
  winner: boolean;
}

export interface PickUpPileRequest {
  gameId: string;
  playerId: PlayerId;
}

export interface PickUpPileResponse {
  gameState: PlayerView;
}

// Error responses

export interface ErrorResponse {
  error: string;
  message?: string;
}
