/**
 * Socket.IO event types
 */

import { LobbyId, LobbyState } from './lobby';
import { PlayerId, Player } from './player';
import { PlayerView } from './game';

// Lobby events

export interface LobbyJoinEvent {
  lobbyId: LobbyId;
  playerId: PlayerId;
}

export interface LobbyPlayerJoinedEvent {
  player: Player;
  lobby: LobbyState;
}

export interface LobbyPlayerLeftEvent {
  playerId: PlayerId;
  lobby: LobbyState;
}

export interface LobbyLeaderChangedEvent {
  newLeaderId: PlayerId;
  lobby: LobbyState;
}

export interface LobbyGameStartingEvent {
  gameId: string;
}

// Game events
// NOTE: Game mutations go through HTTP API, not WebSocket events.
// These events are server-to-client notifications only.

export interface GameStateUpdateEvent {
  gameState: PlayerView;
}

export interface GameTurnChangeEvent {
  activePlayerId: PlayerId;
}

export interface GamePileBlownEvent {
  playerId: PlayerId;
  reason: 'ten' | 'four_of_kind';
}

export interface GamePlayerWonEvent {
  winnerId: PlayerId;
  winnerName: string;
}

// Client-to-Server event map
// NOTE: WebSockets are READ-ONLY for the client. All mutations go through HTTP API.
// These events are only for subscribing/unsubscribing to room notifications.
export interface ClientToServerEvents {
  'lobby:join': (data: LobbyJoinEvent) => void;
  'lobby:leave': (data: { lobbyId: LobbyId; playerId: PlayerId }) => void;
}

// Error event
export interface ErrorEvent {
  message: string;
}

// Server-to-Client event map
export interface ServerToClientEvents {
  'lobby:playerJoined': (data: LobbyPlayerJoinedEvent) => void;
  'lobby:playerLeft': (data: LobbyPlayerLeftEvent) => void;
  'lobby:leaderChanged': (data: LobbyLeaderChangedEvent) => void;
  'lobby:gameStarting': (data: LobbyGameStartingEvent) => void;
  'game:stateUpdate': (data: GameStateUpdateEvent) => void;
  'game:turnChange': (data: GameTurnChangeEvent) => void;
  'game:pileBlown': (data: GamePileBlownEvent) => void;
  'game:playerWon': (data: GamePlayerWonEvent) => void;
  'error': (data: ErrorEvent) => void;
}
