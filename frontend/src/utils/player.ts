import { v4 as uuidv4 } from 'uuid'

const PLAYER_ID_KEY = 'hilo:playerId'
const PLAYER_NAME_KEY = 'hilo:playerName'
const LOBBY_ID_KEY = 'hilo:lobbyId'
const GAME_ID_KEY = 'hilo:gameId'

/**
 * Get or create player ID
 */
export function getPlayerId(): string {
  let playerId = localStorage.getItem(PLAYER_ID_KEY)

  if (!playerId) {
    playerId = uuidv4()
    localStorage.setItem(PLAYER_ID_KEY, playerId)
  }

  return playerId
}

/**
 * Get stored player name
 */
export function getPlayerName(): string | null {
  return localStorage.getItem(PLAYER_NAME_KEY)
}

/**
 * Save player name
 */
export function savePlayerName(name: string): void {
  localStorage.setItem(PLAYER_NAME_KEY, name)
}

/**
 * Clear player data (for testing/logout)
 */
export function clearPlayerData(): void {
  localStorage.removeItem(PLAYER_ID_KEY)
  localStorage.removeItem(PLAYER_NAME_KEY)
  localStorage.removeItem(LOBBY_ID_KEY)
  localStorage.removeItem(GAME_ID_KEY)
}

/**
 * Get stored lobby ID for session recovery
 */
export function getLobbyId(): string | null {
  return localStorage.getItem(LOBBY_ID_KEY)
}

/**
 * Save lobby ID for session recovery
 */
export function saveLobbyId(lobbyId: string): void {
  localStorage.setItem(LOBBY_ID_KEY, lobbyId)
}

/**
 * Clear lobby ID (when leaving lobby)
 */
export function clearLobbyId(): void {
  localStorage.removeItem(LOBBY_ID_KEY)
}

/**
 * Get stored game ID for session recovery
 */
export function getGameId(): string | null {
  return localStorage.getItem(GAME_ID_KEY)
}

/**
 * Save game ID for session recovery
 */
export function saveGameId(gameId: string): void {
  localStorage.setItem(GAME_ID_KEY, gameId)
}

/**
 * Clear game ID (when game ends)
 */
export function clearGameId(): void {
  localStorage.removeItem(GAME_ID_KEY)
}
