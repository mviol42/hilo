import { useEffect } from 'react'
import type { Card as CardType } from '@hilo/shared'
import { Card } from './Card'

interface PlayAnimationProps {
  cards: CardType[]
  playerName: string
  pileBlownMessage?: string  // Optional message for pile blown events
  onComplete: () => void
}

export function PlayAnimation({ cards, playerName, pileBlownMessage, onComplete }: PlayAnimationProps) {
  useEffect(() => {
    // Auto-dismiss after animation completes
    // Longer timeout if there's a pile blown message to read
    const timer = setTimeout(onComplete, pileBlownMessage ? 1000 : 650)
    return () => clearTimeout(timer)
  }, [onComplete, pileBlownMessage])

  if (cards.length === 0) return null

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center pointer-events-none z-50 bg-black/50">
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
        {pileBlownMessage && (
          <div className="text-3xl font-bold text-green-400 mt-4 animate-card-reveal">
            {pileBlownMessage}
          </div>
        )}
      </div>
    </div>
  )
}
