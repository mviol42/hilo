import { useEffect } from 'react'
import type { Card as CardType } from '@hilo/shared'
import { Card } from './Card'

interface PlayAnimationProps {
  cards: CardType[]
  playerName: string
  resultMessage?: string  // Result message (pile blown, picked up pile, etc)
  resultType?: 'success' | 'warning' | 'info'  // Color coding for result
  nextTurnMessage?: string  // Whose turn is next
  isPickup?: boolean  // Is this displaying a pickup (where there are no cards)
  onComplete: () => void
}

export function PlayAnimation({
  cards,
  playerName,
  resultMessage,
  resultType = 'success',
  nextTurnMessage,
  isPickup,
  onComplete
}: PlayAnimationProps) {
  useEffect(() => {
    // Auto-dismiss after animation completes
    // Longer timeout if there's additional info to read
    const hasExtra = resultMessage || nextTurnMessage
    const timer = setTimeout(onComplete, hasExtra ? 1200 : 650)
    return () => clearTimeout(timer)
  }, [onComplete, resultMessage, nextTurnMessage])

  if (cards.length === 0 && !isPickup) return null

  const resultColorClass = {
    success: 'text-green-400',
    warning: 'text-orange-400',
    info: 'text-blue-400',
  }[resultType]

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center pointer-events-none z-50 bg-black/50">
      {!isPickup && (() => {
        return (
          <div className="flex flex-col items-center gap-4">
            <div className="text-2xl font-bold text-white mb-4">
              {playerName} played:
            </div>
            <div className="flex gap-2">
              {cards.map((card, index) => (
                <div key={`${card.rank}-${card.suit}-${index}`} className="animate-card-reveal">
                  <Card card={card} size="large" />
                </div>
              ))}
            </div>
        </div>
        )
      })()}
      
      {resultMessage && (
          <div className={`text-3xl font-bold mt-4 animate-card-reveal ${resultColorClass}`}>
            {resultMessage}
          </div>
        )}
        {nextTurnMessage && (
          <div className="text-xl text-gray-300 mt-2 animate-card-reveal">
            {nextTurnMessage}
          </div>
        )}
    </div>
  )
}
