import { render, screen, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom'
import { PlayerProvider, usePlayer } from './PlayerContext'

describe('PlayerContext', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  function TestComponent() {
    const { playerId, playerName, setPlayerName } = usePlayer()
    return (
      <div>
        <p data-testid="player-id">{playerId}</p>
        <p data-testid="player-name">{playerName || 'No name'}</p>
        <button onClick={() => setPlayerName('Alice')}>Set Name</button>
      </div>
    )
  }

  it('provides player ID on mount', () => {
    render(
      <PlayerProvider>
        <TestComponent />
      </PlayerProvider>
    )

    const playerId = screen.getByTestId('player-id').textContent
    expect(playerId).toBeTruthy()
    expect(playerId).toHaveLength(36) // UUID length
  })

  it('persists player ID in localStorage', () => {
    render(
      <PlayerProvider>
        <TestComponent />
      </PlayerProvider>
    )

    const playerId = screen.getByTestId('player-id').textContent
    expect(localStorage.getItem('hilo_player_id')).toBe(playerId)
  })

  it('reuses existing player ID from localStorage', () => {
    const existingId = 'existing-player-id'
    localStorage.setItem('hilo_player_id', existingId)

    render(
      <PlayerProvider>
        <TestComponent />
      </PlayerProvider>
    )

    expect(screen.getByTestId('player-id')).toHaveTextContent(existingId)
  })

  it('updates player name', async () => {
    const user = userEvent.setup()

    render(
      <PlayerProvider>
        <TestComponent />
      </PlayerProvider>
    )

    expect(screen.getByTestId('player-name')).toHaveTextContent('No name')

    await user.click(screen.getByText('Set Name'))

    expect(screen.getByTestId('player-name')).toHaveTextContent('Alice')
  })

  it('persists player name in localStorage', async () => {
    const user = userEvent.setup()

    render(
      <PlayerProvider>
        <TestComponent />
      </PlayerProvider>
    )

    await user.click(screen.getByText('Set Name'))

    expect(localStorage.getItem('hilo_player_name')).toBe('Alice')
  })

  it('loads existing player name from localStorage', () => {
    localStorage.setItem('hilo_player_name', 'Bob')

    render(
      <PlayerProvider>
        <TestComponent />
      </PlayerProvider>
    )

    expect(screen.getByTestId('player-name')).toHaveTextContent('Bob')
  })

  it('throws error when usePlayer is used outside provider', () => {
    // Suppress console.error for this test
    const originalError = console.error
    console.error = vi.fn()

    expect(() => {
      renderHook(() => usePlayer())
    }).toThrow('usePlayer must be used within PlayerProvider')

    console.error = originalError
  })
})
