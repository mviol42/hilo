import axios, { AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { LobbyId, LobbyState } from '@hilo/shared/types/lobby';
import { PlayerId } from '@hilo/shared/types/player';
import { PlayerView } from '@hilo/shared/types/game';
import { Card } from '@hilo/shared/types/cards';
import { logger } from './logger';

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

    this.setupLogging();
  }

  private setupLogging(): void {
    // Request interceptor
    this.axios.interceptors.request.use(
      (config) => {
        logger.info(
          `HTTP Request: ${JSON.stringify({
            method: config.method?.toUpperCase(),
            route: config.url,
            body: config.data,
            timestamp: new Date().toISOString(),
          })}`
        );
        return config;
      },
      (error) => {
        logger.error(`HTTP Request Error: ${error.message}`);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.axios.interceptors.response.use(
      (response) => {
        logger.info(
          `HTTP Response: ${JSON.stringify({
            method: response.config.method?.toUpperCase(),
            route: response.config.url,
            statusCode: response.status,
            timestamp: new Date().toISOString(),
          })}`
        );
        return response;
      },
      (error) => {
        const statusCode = error.response?.status || 'N/A';
        const route = error.config?.url || 'unknown';
        logger.error(
          `HTTP Response Error: ${JSON.stringify({
            method: error.config?.method?.toUpperCase(),
            route,
            statusCode,
            message: error.message,
            timestamp: new Date().toISOString(),
          })}`
        );
        return Promise.reject(error);
      }
    );
  }

  async createLobby(): Promise<CreateLobbyResponse> {
    const response = await this.axios.post<CreateLobbyResponse>('/api/lobby/create');
    return response.data;
  }

  async joinLobby(lobbyId: LobbyId, playerName?: string): Promise<JoinLobbyResponse> {
    // Generate player ID locally
    const playerId = uuidv4();

    logger.debug(`Generated local player ID: ${playerId} for player: ${playerName || 'Anonymous'}`);

    const response = await this.axios.post<JoinLobbyResponse>('/api/lobby/join', {
      lobbyId,
      playerId,
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

  async startGame(lobbyId: LobbyId, playerId: PlayerId): Promise<{ gameState: PlayerView }> {
    const response = await this.axios.post<{ gameState: PlayerView }>('/api/game/start', {
      lobbyId,
      playerId,
    });
    return response.data;
  }

  async selectFaceUp(
    gameId: string,
    playerId: PlayerId,
    cards: Card[]
  ): Promise<{ gameState: PlayerView }> {
    const response = await this.axios.post<{ gameState: PlayerView }>('/api/game/select-faceup', {
      gameId,
      playerId,
      cards,
    });
    return response.data;
  }

  async playCards(
    gameId: string,
    playerId: PlayerId,
    cards: Card[]
  ): Promise<{ gameState: PlayerView; blowUp: boolean; winner: boolean }> {
    const response = await this.axios.post<{
      gameState: PlayerView;
      blowUp: boolean;
      winner: boolean;
    }>('/api/game/play-cards', {
      gameId,
      playerId,
      cards,
    });
    return response.data;
  }

  async pickUpPile(gameId: string, playerId: PlayerId): Promise<{ gameState: PlayerView }> {
    const response = await this.axios.post<{ gameState: PlayerView }>('/api/game/pickup-pile', {
      gameId,
      playerId,
    });
    return response.data;
  }
}
