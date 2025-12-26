import { v4 as uuidv4 } from 'uuid'

const PLAYER_ID_KEY = 'hilo:playerId'
const PLAYER_NAME_KEY = 'hilo:playerName'

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
}
