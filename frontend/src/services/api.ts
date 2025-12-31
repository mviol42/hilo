import axios, { AxiosError } from 'axios'
import type { AxiosInstance } from 'axios'
import type {
  CreateLobbyResponse,
  JoinLobbyRequest,
  JoinLobbyResponse,
  LobbyStatusResponse,
  ReadyLobbyRequest,
  ReadyLobbyResponse,
  LeaveLobbyRequest,
  LeaveLobbyResponse,
  StartGameRequest,
  StartGameResponse,
  SelectFaceUpRequest,
  SelectFaceUpResponse,
  PlayCardsRequest,
  PlayCardsResponse,
  PickUpPileRequest,
  PickUpPileResponse,
  PlayAgainRequest,
  PlayAgainResponse,
  ErrorResponse,
} from '@hilo/shared'
import { config } from '@/config'

class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: config.apiUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    })

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ErrorResponse>) => {
        console.error('API Error:', error.response?.data || error.message)
        throw error
      }
    )
  }

  // Lobby endpoints

  async createLobby(): Promise<CreateLobbyResponse> {
    const response = await this.client.post<CreateLobbyResponse>('/api/lobby/create')
    return response.data
  }

  async getLobbyStatus(lobbyId: string): Promise<LobbyStatusResponse> {
    const response = await this.client.get<LobbyStatusResponse>(`/api/lobby/${lobbyId}/status`)
    return response.data
  }

  async joinLobby(request: JoinLobbyRequest): Promise<JoinLobbyResponse> {
    const response = await this.client.post<JoinLobbyResponse>('/api/lobby/join', request)
    return response.data
  }

  async readyLobby(request: ReadyLobbyRequest): Promise<ReadyLobbyResponse> {
    const response = await this.client.post<ReadyLobbyResponse>('/api/lobby/ready', request)
    return response.data
  }

  async leaveLobby(request: LeaveLobbyRequest): Promise<LeaveLobbyResponse> {
    const response = await this.client.post<LeaveLobbyResponse>('/api/lobby/leave', request)
    return response.data
  }

  // Game endpoints

  async startGame(request: StartGameRequest): Promise<StartGameResponse> {
    const response = await this.client.post<StartGameResponse>('/api/game/start', request)
    return response.data
  }

  async selectFaceUp(request: SelectFaceUpRequest): Promise<SelectFaceUpResponse> {
    console.log('[ApiClient] selectFaceUp request:', {
      gameId: request.gameId?.substring(0, 8),
      playerId: request.playerId?.substring(0, 8),
      cards: request.cards?.length,
    })
    const response = await this.client.post<SelectFaceUpResponse>('/api/game/select-faceup', request)
    console.log('[ApiClient] selectFaceUp response received, phase:', response.data.gameState.phase)
    return response.data
  }

  async playCards(request: PlayCardsRequest): Promise<PlayCardsResponse> {
    const response = await this.client.post<PlayCardsResponse>('/api/game/play-cards', request)
    return response.data
  }

  async pickUpPile(request: PickUpPileRequest): Promise<PickUpPileResponse> {
    const response = await this.client.post<PickUpPileResponse>('/api/game/pickup-pile', request)
    return response.data
  }

  async playAgain(request: PlayAgainRequest): Promise<PlayAgainResponse> {
    const response = await this.client.post<PlayAgainResponse>('/api/game/play-again', request)
    return response.data
  }
}

export const apiClient = new ApiClient()
