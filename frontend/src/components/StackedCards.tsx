import type { Card as CardType } from '@hilo/shared'
import { Card } from './Card'

interface StackedCardsProps {
  faceUpCards: CardType[]
  faceDownCount: number
  faceDownPlayed?: boolean[]
  onFaceDownClick?: (index: number) => void
  isMyTurn?: boolean
  isPlayingFromFaceDown?: boolean
  size?: 'small' | 'medium'
  className?: string
}

export function StackedCards({
  faceUpCards,
  faceDownCount,
  faceDownPlayed,
  onFaceDownClick,
  isMyTurn = false,
  isPlayingFromFaceDown = false,
  size = 'medium',
  className = '',
}: StackedCardsProps) {
  // Create array of face-down slots based on count
  // If faceDownPlayed is provided, use it; otherwise assume all unplayed
  const faceDownSlots = faceDownPlayed || Array(faceDownCount).fill(false)
  const unplayedFaceDownCount = faceDownSlots.filter(played => !played).length

  // Size classes for the cards
  const cardSizeClass = size === 'small' ? 'w-12 h-16' : 'w-16 h-24'
  const gapClass = size === 'small' ? 'gap-1' : 'gap-2'
  // Offset to show face-down cards peeking out - smaller for small cards
  const stackOffset = size === 'small' ? '-mt-12' : '-mt-20'

  // When playing from face-down, only show the face-down cards (larger, interactive)
  if (isPlayingFromFaceDown) {
    return (
      <div className={`bg-gray-800/50 rounded-lg p-4 ${className}`}>
        <h3 className="text-lg font-semibold mb-2 text-white">Your Face-Down Cards</h3>
        <div className={`flex ${gapClass} justify-center`}>
          {faceDownSlots.map((isPlayed: boolean, index: number) => (
            <div key={index} className="flex flex-col items-center gap-2">
              {!isPlayed ? (
                <Card
                  card={{ rank: '2', suit: 'hearts' }}
                  size={size}
                  faceDown
                  selectable={isMyTurn && !!onFaceDownClick}
                  onClick={isMyTurn && onFaceDownClick ? () => onFaceDownClick(index) : undefined}
                />
              ) : (
                <div className={`${cardSizeClass} border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center text-gray-600 text-xs`}>
                  Played
                </div>
              )}
            </div>
          ))}
        </div>
        {isMyTurn && onFaceDownClick && (
          <p className="text-sm text-gray-400 text-center mt-4">
            Select a face-down card to play (blind)
          </p>
        )}
      </div>
    )
  }

  // Don't render if no cards to show
  if (faceUpCards.length === 0 && unplayedFaceDownCount === 0) {
    return null
  }

  return (
    <div className={`relative ${className}`}>
      {/* Stacked visualization */}
      <div className="flex flex-col items-center">
        {/* Face-Up Cards (on top) */}
        {faceUpCards.length > 0 && (
          <div className={`flex ${gapClass} justify-center relative z-10`}>
            {faceUpCards.map((card, index) => (
              <Card
                key={`faceup-${card.rank}-${card.suit}-${index}`}
                card={card}
                size={size}
              />
            ))}
          </div>
        )}

        {/* Face-Down Cards (peeking out underneath) */}
        {unplayedFaceDownCount > 0 && (
          <div
            className={`flex ${gapClass} justify-center ${faceUpCards.length > 0 ? `${stackOffset} relative z-0` : ''}`}
          >
            {faceDownSlots.map((isPlayed: boolean, index: number) => (
              !isPlayed && (
                <div
                  key={`facedown-${index}`}
                  className={`${cardSizeClass} bg-gradient-to-br from-blue-700 to-blue-900 border-2 border-blue-900 rounded-lg opacity-60`}
                  style={{
                    backgroundImage: 'repeating-linear-gradient(45deg, #3b82f6, #3b82f6 10px, #1e40af 10px, #1e40af 20px)',
                  }}
                />
              )
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
