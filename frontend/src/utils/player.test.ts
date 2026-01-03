import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getPlayerId,
  savePlayerName,
  getPlayerName,
  getLobbyId,
  saveLobbyId,
  clearLobbyId,
  getGameId,
  saveGameId,
  clearGameId,
  clearPlayerData,
} from './player'

describe('player utilities', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getPlayerId', () => {
    it('generates a valid UUID when none exists', () => {
      const playerId = getPlayerId()
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      expect(playerId).toMatch(uuidRegex)
    })

    it('returns existing player ID from localStorage', () => {
      const existingId = 'existing-player-id'
      localStorage.setItem('hilo:playerId', existingId)
      const playerId = getPlayerId()
      expect(playerId).toBe(existingId)
    })

    it('persists generated ID to localStorage', () => {
      const playerId = getPlayerId()
      expect(localStorage.getItem('hilo:playerId')).toBe(playerId)
    })
  })

  describe('savePlayerName and getPlayerName', () => {
    it('saves and retrieves player name', () => {
      savePlayerName('Alice')
      const loaded = getPlayerName()
      expect(loaded).toBe('Alice')
    })

    it('returns null when no player name is saved', () => {
      const loaded = getPlayerName()
      expect(loaded).toBe(null)
    })

    it('overwrites previous player name', () => {
      savePlayerName('Alice')
      savePlayerName('Bob')
      const loaded = getPlayerName()
      expect(loaded).toBe('Bob')
    })

    it('persists to localStorage', () => {
      savePlayerName('Charlie')
      expect(localStorage.getItem('hilo:playerName')).toBe('Charlie')
    })
  })

  describe('lobby ID for session recovery', () => {
    it('returns null when no lobby ID is saved', () => {
      expect(getLobbyId()).toBe(null)
    })

    it('saves and retrieves lobby ID', () => {
      saveLobbyId('lobby-123')
      expect(getLobbyId()).toBe('lobby-123')
    })

    it('clears lobby ID', () => {
      saveLobbyId('lobby-123')
      clearLobbyId()
      expect(getLobbyId()).toBe(null)
    })
  })

  describe('game ID for session recovery', () => {
    it('returns null when no game ID is saved', () => {
      expect(getGameId()).toBe(null)
    })

    it('saves and retrieves game ID', () => {
      saveGameId('game-456')
      expect(getGameId()).toBe('game-456')
    })

    it('clears game ID', () => {
      saveGameId('game-456')
      clearGameId()
      expect(getGameId()).toBe(null)
    })
  })

  describe('clearPlayerData', () => {
    it('clears all player data including lobby and game IDs', () => {
      savePlayerName('Alice')
      saveLobbyId('lobby-123')
      saveGameId('game-456')

      clearPlayerData()

      expect(getPlayerName()).toBe(null)
      expect(getLobbyId()).toBe(null)
      expect(getGameId()).toBe(null)
    })
  })
})
