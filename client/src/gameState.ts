import { LobbyState, LobbyId } from '@hilo/shared/types/lobby';
import { PlayerId } from '@hilo/shared/types/player';
import { PlayerView } from '@hilo/shared/types/game';

export interface ClientState {
  phase: 'menu' | 'lobby' | 'game' | 'ended';
  lobbyId?: LobbyId;
  playerId?: PlayerId;
  playerName?: string;
  isLeader: boolean;
  lobby?: LobbyState;
  gameId?: string;
  gameState?: PlayerView;
  winnerId?: PlayerId;
  winnerName?: string;
}

export class GameStateManager {
  private state: ClientState;

  constructor() {
    this.state = {
      phase: 'menu',
      isLeader: false,
    };
  }

  getState(): Readonly<ClientState> {
    return this.state;
  }

  setLobby(lobbyId: LobbyId, playerId: PlayerId, playerName: string, isLeader: boolean, lobby: LobbyState): void {
    this.state = {
      ...this.state,
      phase: 'lobby',
      lobbyId,
      playerId,
      playerName,
      isLeader,
      lobby,
    };
  }

  updateLobby(lobby: LobbyState): void {
    this.state = {
      ...this.state,
      lobby,
    };
  }

  updateLeader(isLeader: boolean): void {
    this.state = {
      ...this.state,
      isLeader,
    };
  }

  startGame(gameId: string): void {
    this.state = {
      ...this.state,
      phase: 'game',
      gameId,
    };
  }

  updateGameState(gameState: PlayerView): void {
    this.state = {
      ...this.state,
      gameState,
    };
  }

  setWinner(winnerId: PlayerId, winnerName: string): void {
    this.state = {
      ...this.state,
      phase: 'ended',
      winnerId,
      winnerName,
    };
  }

  reset(): void {
    this.state = {
      phase: 'menu',
      isLeader: false,
    };
  }
}
