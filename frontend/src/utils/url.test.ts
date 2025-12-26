import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getLobbyShareLink, copyToClipboard, extractLobbyIdFromUrl } from './url'

describe('url utilities', () => {
  describe('getLobbyShareLink', () => {
    beforeEach(() => {
      // Mock window.location.origin
      Object.defineProperty(window, 'location', {
        value: {
          origin: 'http://localhost:5173',
        },
        writable: true,
      })
    })

    it('generates correct join link with lobby ID', () => {
      const lobbyId = 'abc123'
      const link = getLobbyShareLink(lobbyId)
      expect(link).toBe('http://localhost:5173/join?id=abc123')
    })

    it('handles lobby IDs with special characters', () => {
      const lobbyId = 'abc-123-def'
      const link = getLobbyShareLink(lobbyId)
      expect(link).toBe('http://localhost:5173/join?id=abc-123-def')
    })
  })

  describe('copyToClipboard', () => {
    it('successfully copies text to clipboard', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined)
      Object.assign(navigator, {
        clipboard: {
          writeText: mockWriteText,
        },
      })

      const result = await copyToClipboard('test text')

      expect(result).toBe(true)
      expect(mockWriteText).toHaveBeenCalledWith('test text')
    })

    it('returns false when clipboard write fails', async () => {
      const mockWriteText = vi.fn().mockRejectedValue(new Error('Permission denied'))
      Object.assign(navigator, {
        clipboard: {
          writeText: mockWriteText,
        },
      })

      const result = await copyToClipboard('test text')

      expect(result).toBe(false)
    })
  })

  describe('extractLobbyIdFromUrl', () => {
    it('extracts lobby ID from valid URL', () => {
      const url = 'http://localhost:5173/join?id=abc123'
      const lobbyId = extractLobbyIdFromUrl(url)
      expect(lobbyId).toBe('abc123')
    })

    it('extracts lobby ID from URL with multiple params', () => {
      const url = 'http://localhost:5173/join?foo=bar&id=abc123&baz=qux'
      const lobbyId = extractLobbyIdFromUrl(url)
      expect(lobbyId).toBe('abc123')
    })

    it('returns null when id parameter is missing', () => {
      const url = 'http://localhost:5173/join'
      const lobbyId = extractLobbyIdFromUrl(url)
      expect(lobbyId).toBe(null)
    })

    it('returns null for invalid URL', () => {
      const url = 'not-a-url'
      const lobbyId = extractLobbyIdFromUrl(url)
      expect(lobbyId).toBe(null)
    })
  })
})
