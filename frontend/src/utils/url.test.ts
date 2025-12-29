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
    let mockExecCommand: ReturnType<typeof vi.fn>

    beforeEach(() => {
      // Mock document.execCommand for fallback testing
      mockExecCommand = vi.fn().mockReturnValue(true)
      document.execCommand = mockExecCommand as typeof document.execCommand
    })

    it('successfully copies text using Clipboard API', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined)
      Object.assign(navigator, {
        clipboard: {
          writeText: mockWriteText,
        },
      })

      const result = await copyToClipboard('test text')

      expect(result).toBe(true)
      expect(mockWriteText).toHaveBeenCalledWith('test text')
      expect(mockExecCommand).not.toHaveBeenCalled()
    })

    it('falls back to execCommand when Clipboard API fails (iOS Safari/Chrome)', async () => {
      const mockWriteText = vi.fn().mockRejectedValue(new Error('NotAllowedError'))
      Object.assign(navigator, {
        clipboard: {
          writeText: mockWriteText,
        },
      })

      const result = await copyToClipboard('test text')

      expect(result).toBe(true)
      expect(mockWriteText).toHaveBeenCalledWith('test text')
      expect(mockExecCommand).toHaveBeenCalledWith('copy')
    })

    it('returns false when both Clipboard API and fallback fail', async () => {
      const mockWriteText = vi.fn().mockRejectedValue(new Error('NotAllowedError'))
      Object.assign(navigator, {
        clipboard: {
          writeText: mockWriteText,
        },
      })
      mockExecCommand.mockReturnValue(false)

      const result = await copyToClipboard('test text')

      expect(result).toBe(false)
    })

    it('uses fallback when Clipboard API is not available', async () => {
      Object.assign(navigator, {
        clipboard: undefined,
      })

      const result = await copyToClipboard('test text')

      expect(result).toBe(true)
      expect(mockExecCommand).toHaveBeenCalledWith('copy')
    })

    it('returns false when Clipboard API unavailable and fallback fails', async () => {
      Object.assign(navigator, {
        clipboard: undefined,
      })
      mockExecCommand.mockReturnValue(false)

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
