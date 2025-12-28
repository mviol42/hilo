import { render, screen, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom'
import { PlayAnimation } from './PlayAnimation'
import type { Card } from '@hilo/shared'

describe('PlayAnimation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const mockCards: Card[] = [
    { rank: '5', suit: 'hearts' },
    { rank: '5', suit: 'diamonds' },
  ]

  it('renders with cards and player name', () => {
    const onComplete = vi.fn()

    render(
      <PlayAnimation
        cards={mockCards}
        playerName="Alice"
        onComplete={onComplete}
      />
    )

    expect(screen.getByText('Alice played:')).toBeInTheDocument()
    // Check for card ranks
    expect(screen.getAllByText('5')).toHaveLength(2)
    // Check for heart and diamond suits
    expect(screen.getByText('♥')).toBeInTheDocument()
    expect(screen.getByText('♦')).toBeInTheDocument()
  })

  it('renders nothing when cards array is empty', () => {
    const onComplete = vi.fn()

    const { container } = render(
      <PlayAnimation
        cards={[]}
        playerName="Alice"
        onComplete={onComplete}
      />
    )

    expect(container.firstChild).toBeNull()
  })

  it('renders resultMessage when provided', () => {
    const onComplete = vi.fn()

    render(
      <PlayAnimation
        cards={mockCards}
        playerName="Alice"
        resultMessage="Pile blown up!"
        resultType="success"
        onComplete={onComplete}
      />
    )

    expect(screen.getByText('Alice played:')).toBeInTheDocument()
    expect(screen.getByText('Pile blown up!')).toBeInTheDocument()
  })

  it('renders nextTurnMessage when provided', () => {
    const onComplete = vi.fn()

    render(
      <PlayAnimation
        cards={mockCards}
        playerName="Alice"
        nextTurnMessage="Bob's turn"
        onComplete={onComplete}
      />
    )

    expect(screen.getByText('Alice played:')).toBeInTheDocument()
    expect(screen.getByText("Bob's turn")).toBeInTheDocument()
  })

  it('renders both resultMessage and nextTurnMessage', () => {
    const onComplete = vi.fn()

    render(
      <PlayAnimation
        cards={mockCards}
        playerName="Alice"
        resultMessage="Go again!"
        resultType="success"
        nextTurnMessage="Your turn!"
        onComplete={onComplete}
      />
    )

    expect(screen.getByText('Alice played:')).toBeInTheDocument()
    expect(screen.getByText('Go again!')).toBeInTheDocument()
    expect(screen.getByText('Your turn!')).toBeInTheDocument()
  })

  it('applies correct color class for success resultType', () => {
    const onComplete = vi.fn()

    render(
      <PlayAnimation
        cards={mockCards}
        playerName="Alice"
        resultMessage="Success!"
        resultType="success"
        onComplete={onComplete}
      />
    )

    const resultElement = screen.getByText('Success!')
    expect(resultElement).toHaveClass('text-green-400')
  })

  it('applies correct color class for warning resultType', () => {
    const onComplete = vi.fn()

    render(
      <PlayAnimation
        cards={mockCards}
        playerName="Alice"
        resultMessage="Warning!"
        resultType="warning"
        onComplete={onComplete}
      />
    )

    const resultElement = screen.getByText('Warning!')
    expect(resultElement).toHaveClass('text-orange-400')
  })

  it('applies correct color class for info resultType', () => {
    const onComplete = vi.fn()

    render(
      <PlayAnimation
        cards={mockCards}
        playerName="Alice"
        resultMessage="Info!"
        resultType="info"
        onComplete={onComplete}
      />
    )

    const resultElement = screen.getByText('Info!')
    expect(resultElement).toHaveClass('text-blue-400')
  })

  it('calls onComplete after timeout (short - no extra info)', async () => {
    const onComplete = vi.fn()

    render(
      <PlayAnimation
        cards={mockCards}
        playerName="Alice"
        onComplete={onComplete}
      />
    )

    expect(onComplete).not.toHaveBeenCalled()

    // Without resultMessage/nextTurnMessage, timeout is 650ms
    act(() => {
      vi.advanceTimersByTime(649)
    })
    expect(onComplete).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(2)
    })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('calls onComplete after longer timeout (with extra info)', async () => {
    const onComplete = vi.fn()

    render(
      <PlayAnimation
        cards={mockCards}
        playerName="Alice"
        resultMessage="Pile blown!"
        onComplete={onComplete}
      />
    )

    expect(onComplete).not.toHaveBeenCalled()

    // With resultMessage, timeout is 1200ms
    act(() => {
      vi.advanceTimersByTime(1199)
    })
    expect(onComplete).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(2)
    })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('renders overlay with correct z-index', () => {
    const onComplete = vi.fn()

    const { container } = render(
      <PlayAnimation
        cards={mockCards}
        playerName="Alice"
        onComplete={onComplete}
      />
    )

    const overlay = container.querySelector('.z-50')
    expect(overlay).toBeInTheDocument()
  })

  it('renders cards with animation class', () => {
    const onComplete = vi.fn()

    const { container } = render(
      <PlayAnimation
        cards={mockCards}
        playerName="Alice"
        onComplete={onComplete}
      />
    )

    const animatedCards = container.querySelectorAll('.animate-card-reveal')
    expect(animatedCards.length).toBeGreaterThanOrEqual(2)
  })
})
