import axios, { AxiosInstance } from 'axios';
import { LobbyId, LobbyState } from '@hilo/shared/types/lobby';
import { PlayerId } from '@hilo/shared/types/player';

export interface CreateLobbyResponse {
  lobbyId: LobbyId;
}

export interface JoinLobbyResponse {
  playerId: PlayerId;
  isLeader: boolean;
  lobby: LobbyState;
}

export class ApiClient {
  private axios: AxiosInstance;

  constructor(baseURL: string = 'http://localhost:3000') {
    this.axios = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async createLobby(): Promise<CreateLobbyResponse> {
    const response = await this.axios.post<CreateLobbyResponse>('/api/lobby/create');
    return response.data;
  }

  async joinLobby(lobbyId: LobbyId, playerName?: string): Promise<JoinLobbyResponse> {
    const response = await this.axios.post<JoinLobbyResponse>('/api/lobby/join', {
      lobbyId,
      playerName,
    });
    return response.data;
  }

  async leaveLobby(lobbyId: LobbyId, playerId: PlayerId): Promise<void> {
    await this.axios.post('/api/lobby/leave', {
      lobbyId,
      playerId,
    });
  }

  async startGame(lobbyId: LobbyId, playerId: PlayerId): Promise<{ gameId: string }> {
    const response = await this.axios.post<{ gameId: string }>('/api/game/start', {
      lobbyId,
      playerId,
    });
    return response.data;
  }
}
