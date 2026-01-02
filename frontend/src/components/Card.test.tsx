import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom'
import { Card } from './Card'

describe('Card', () => {
  const mockCard = { rank: 'A' as const, suit: 'hearts' as const }

  it('renders card rank and suit', () => {
    render(<Card card={mockCard} />)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('♥')).toBeInTheDocument()
  })

  it('renders face down when faceDown is true', () => {
    const { container } = render(<Card card={mockCard} faceDown />)
    expect(screen.queryByText('A')).not.toBeInTheDocument()
    expect(container.querySelector('.bg-gradient-to-br')).toBeInTheDocument()
  })

  it('calls onClick when selectable and clicked', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()

    render(<Card card={mockCard} selectable onClick={handleClick} />)

    await user.click(screen.getByText('A').closest('div')!)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('does not call onClick when not selectable', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()

    render(<Card card={mockCard} onClick={handleClick} />)

    await user.click(screen.getByText('A').closest('div')!)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('applies selected styling when selected is true', () => {
    const { container } = render(<Card card={mockCard} selected />)
    const cardElement = container.querySelector('.border-blue-500')
    expect(cardElement).toBeInTheDocument()
  })

  it('applies playable animation when playable and selectable are true', () => {
    const { container } = render(<Card card={mockCard} playable selectable />)
    const cardElement = container.querySelector('.animate-pulse-green')
    expect(cardElement).toBeInTheDocument()
  })

  it('applies dimmed styling when dimmed is true', () => {
    const { container } = render(<Card card={mockCard} dimmed />)
    const cardElement = container.querySelector('.opacity-40')
    expect(cardElement).toBeInTheDocument()
  })

  it('renders small size', () => {
    const { container } = render(<Card card={mockCard} size="small" />)
    const cardElement = container.querySelector('.w-12')
    expect(cardElement).toBeInTheDocument()
  })

  it('renders medium size', () => {
    const { container } = render(<Card card={mockCard} size="medium" />)
    const cardElement = container.querySelector('.w-16')
    expect(cardElement).toBeInTheDocument()
  })

  it('renders large size', () => {
    const { container } = render(<Card card={mockCard} size="large" />)
    const cardElement = container.querySelector('.w-24')
    expect(cardElement).toBeInTheDocument()
  })

  it('renders red suits in red color', () => {
    const { container: heartsContainer } = render(
      <Card card={{ rank: 'K', suit: 'hearts' }} />
    )
    const { container: diamondsContainer } = render(
      <Card card={{ rank: 'Q', suit: 'diamonds' }} />
    )

    expect(heartsContainer.querySelector('.text-red-600')).toBeInTheDocument()
    expect(diamondsContainer.querySelector('.text-red-600')).toBeInTheDocument()
  })

  it('renders black suits in black color', () => {
    const { container: clubsContainer } = render(
      <Card card={{ rank: 'J', suit: 'clubs' }} />
    )
    const { container: spadesContainer } = render(
      <Card card={{ rank: '10', suit: 'spades' }} />
    )

    expect(clubsContainer.querySelector('.text-gray-900')).toBeInTheDocument()
    expect(spadesContainer.querySelector('.text-gray-900')).toBeInTheDocument()
  })

  it('displays correct suit symbols', () => {
    render(<Card card={{ rank: '2', suit: 'hearts' }} />)
    render(<Card card={{ rank: '3', suit: 'diamonds' }} />)
    render(<Card card={{ rank: '4', suit: 'clubs' }} />)
    render(<Card card={{ rank: '5', suit: 'spades' }} />)

    expect(screen.getByText('♥')).toBeInTheDocument()
    expect(screen.getByText('♦')).toBeInTheDocument()
    expect(screen.getByText('♣')).toBeInTheDocument()
    expect(screen.getByText('♠')).toBeInTheDocument()
  })
})
