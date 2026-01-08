/**
 * HTTP API request/response types
 */

import { LobbyId, LobbyState } from './lobby';
import { PlayerId } from './player';
import { GameState, PlayerView } from './game';
import { Card, DeckStrategy } from './card';

// Lobby endpoints

export interface LobbyStatusResponse {
  exists: boolean;
  gameStarted: boolean;
  playerCount: number;
}

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
  deckStrategy?: DeckStrategy; // Defaults to 'standard' if not provided
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
  cardsPlayed: Card[]; // The actual cards that were played (useful for revealing face-down cards)
  pickedUpPile?: boolean; // True if the player picked up the pile (e.g., face-down card wasn't playable)
}

export interface PickUpPileRequest {
  gameId: string;
  playerId: PlayerId;
}

export interface PickUpPileResponse {
  gameState: PlayerView;
}

// Play again endpoint

export interface PlayAgainRequest {
  gameId: string;
}

export interface PlayAgainResponse {
  lobbyId: LobbyId;
}

// Session rejoin endpoint

export interface RejoinRequest {
  playerId: PlayerId;
  lobbyId?: LobbyId;
  gameId?: string;
}

export interface RejoinResponse {
  success: boolean;
  lobbyId: LobbyId;
  lobby: LobbyState;
  gameId?: string;
  gameState?: PlayerView;
}

// Error responses

export interface ErrorResponse {
  error: string;
  message?: string;
  code?: string;
}
