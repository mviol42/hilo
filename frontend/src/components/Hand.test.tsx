import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom'
import { Hand } from './Hand'
import type { Card } from '@hilo/shared'

describe('Hand', () => {
  const mockCards: Card[] = [
    { rank: '2', suit: 'hearts' },
    { rank: '5', suit: 'diamonds' },
    { rank: 'A', suit: 'spades' },
    { rank: '7', suit: 'clubs' },
  ]

  it('renders all cards', () => {
    render(<Hand cards={mockCards} />)
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('sorts cards by rank', () => {
    const { container } = render(<Hand cards={mockCards} />)
    const cards = container.querySelectorAll('.flex-shrink-0')
    const ranks = Array.from(cards).map((card) => card.textContent)

    // Should be sorted: 2, 5, 7, A
    expect(ranks[0]).toContain('2')
    expect(ranks[1]).toContain('5')
    expect(ranks[2]).toContain('7')
    expect(ranks[3]).toContain('A')
  })

  it('renders title when provided', () => {
    render(<Hand cards={mockCards} title="Your Hand" />)
    expect(screen.getByText('Your Hand')).toBeInTheDocument()
  })

  it('calls onCardClick when card is clicked', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()

    render(
      <Hand
        cards={mockCards}
        playableCards={mockCards}
        onCardClick={handleClick}
      />
    )

    await user.click(screen.getByText('2').closest('div')!)
    expect(handleClick).toHaveBeenCalledWith({ rank: '2', suit: 'hearts' })
  })

  it('highlights selected cards', () => {
    const selectedCards: Card[] = [{ rank: '5', suit: 'diamonds' }]
    const { container } = render(
      <Hand cards={mockCards} selectedCards={selectedCards} />
    )

    const selectedCard = container.querySelector('.border-blue-500')
    expect(selectedCard).toBeInTheDocument()
  })

  it('highlights playable cards', () => {
    const playableCards: Card[] = [{ rank: 'A', suit: 'spades' }]
    const { container } = render(
      <Hand cards={mockCards} playableCards={playableCards} onCardClick={() => {}} />
    )

    const playableCard = container.querySelector('.animate-pulse-green')
    expect(playableCard).toBeInTheDocument()
  })

  it('restricts selection to same rank by default', () => {
    const handleClick = vi.fn()
    const selectedCards: Card[] = [{ rank: '2', suit: 'hearts' }]

    const { container } = render(
      <Hand
        cards={mockCards}
        selectedCards={selectedCards}
        playableCards={mockCards}
        onCardClick={handleClick}
      />
    )

    // Cards with different rank should be dimmed
    const dimmedCards = container.querySelectorAll('.opacity-40')
    expect(dimmedCards.length).toBeGreaterThan(0)
  })

  it('allows mixed ranks when allowMixedRanks is true', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    const selectedCards: Card[] = [{ rank: '2', suit: 'hearts' }]

    render(
      <Hand
        cards={mockCards}
        selectedCards={selectedCards}
        playableCards={mockCards}
        onCardClick={handleClick}
        allowMixedRanks={true}
      />
    )

    // Should be able to click different rank
    await user.click(screen.getByText('5').closest('div')!)
    expect(handleClick).toHaveBeenCalledWith({ rank: '5', suit: 'diamonds' })
  })

  it('renders with custom size', () => {
    const { container } = render(<Hand cards={mockCards} size="large" />)
    const card = container.querySelector('.w-24')
    expect(card).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(
      <Hand cards={mockCards} className="custom-class" />
    )
    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('renders empty hand gracefully', () => {
    const { container } = render(<Hand cards={[]} />)
    const cards = container.querySelectorAll('.flex-shrink-0')
    expect(cards).toHaveLength(0)
  })
})
