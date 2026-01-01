import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom'
import { TurnIndicator } from './TurnIndicator'

describe('TurnIndicator', () => {
  const playerNames = {
    'player1': 'Patrick',
    'player2': 'Richard',
    'player3': 'Mike',
  }

  const turnOrder = ['player1', 'player2', 'player3']

  it('renders current player turn and next player turn', () => {
    render(
      <TurnIndicator
        activePlayerId="player1"
        turnOrder={turnOrder}
        playerNames={playerNames}
        currentPlayerId="player3"
      />
    )

    expect(screen.getByText("Patrick's Turn")).toBeInTheDocument()
    expect(screen.getByText("Richard's Turn")).toBeInTheDocument()
  })

  it('shows "Your Turn" when it is current player\'s turn', () => {
    render(
      <TurnIndicator
        activePlayerId="player1"
        turnOrder={turnOrder}
        playerNames={playerNames}
        currentPlayerId="player1"
      />
    )

    expect(screen.getAllByText('Your Turn')[0]).toBeInTheDocument()
    expect(screen.getByText("Richard's Turn")).toBeInTheDocument()
  })

  it('shows "Your Turn" for the next player when viewing player is on deck', () => {
    render(
      <TurnIndicator
        activePlayerId="player1"
        turnOrder={turnOrder}
        playerNames={playerNames}
        currentPlayerId="player2"
      />
    )

    expect(screen.getByText("Patrick's Turn")).toBeInTheDocument()
    expect(screen.getAllByText('Your Turn')[0]).toBeInTheDocument()
  })

  it('wraps around to first player when active player is last in turn order', () => {
    render(
      <TurnIndicator
        activePlayerId="player3"
        turnOrder={turnOrder}
        playerNames={playerNames}
        currentPlayerId="player1"
      />
    )

    expect(screen.getByText("Mike's Turn")).toBeInTheDocument()
    // Next player should be player1 (wraps around)
    expect(screen.getAllByText('Your Turn')[0]).toBeInTheDocument()
  })

  it('returns null when activePlayerId is not in turnOrder', () => {
    const { container } = render(
      <TurnIndicator
        activePlayerId="unknown-player"
        turnOrder={turnOrder}
        playerNames={playerNames}
        currentPlayerId="player1"
      />
    )

    expect(container.firstChild).toBeNull()
  })

  it('uses fallback name when player name is not in playerNames', () => {
    render(
      <TurnIndicator
        activePlayerId="player1"
        turnOrder={turnOrder}
        playerNames={{ 'player1': 'Patrick' }}
        currentPlayerId="player3"
      />
    )

    expect(screen.getByText("Patrick's Turn")).toBeInTheDocument()
    // player2 has no name, should show fallback
    expect(screen.getByText("Player player2's Turn")).toBeInTheDocument()
  })

  it('applies correct styling - current player in white, next in gray', () => {
    render(
      <TurnIndicator
        activePlayerId="player1"
        turnOrder={turnOrder}
        playerNames={playerNames}
        currentPlayerId="player3"
      />
    )

    const currentPlayer = screen.getByText("Patrick's Turn")
    const nextPlayer = screen.getByText("Richard's Turn")

    expect(currentPlayer).toHaveClass('text-white')
    expect(nextPlayer).toHaveClass('text-gray-400')
  })
})
