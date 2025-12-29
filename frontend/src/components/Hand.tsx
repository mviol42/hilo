import type { Card as CardType } from '@hilo/shared'
import { Card } from './Card'

interface HandProps {
  cards: CardType[]
  selectedCards?: CardType[]
  playableCards?: CardType[]
  onCardClick?: (card: CardType) => void
  title?: string
  size?: 'small' | 'medium' | 'large'
  className?: string
  allowMixedRanks?: boolean // Allow selecting cards of different ranks (for setup phase)
}

function cardsEqual(a: CardType, b: CardType): boolean {
  return a.rank === b.rank && a.suit === b.suit
}

export function Hand({
  cards,
  selectedCards = [],
  playableCards = [],
  onCardClick,
  title,
  size = 'medium',
  className = '',
  allowMixedRanks = false,
}: HandProps) {
  // Sort cards by rank
  const rankOrder = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
  const sortedCards = [...cards].sort((a, b) => {
    const aIndex = rankOrder.indexOf(a.rank)
    const bIndex = rankOrder.indexOf(b.rank)
    if (aIndex !== bIndex) {
      return aIndex - bIndex
    }
    // Secondary sort by suit
    return a.suit.localeCompare(b.suit)
  })

  const isSelected = (card: CardType) => selectedCards.some(c => cardsEqual(c, card))
  const isPlayable = (card: CardType) => playableCards.some(c => cardsEqual(c, card))

  // If some cards are selected, only allow selection of cards with same rank (unless allowMixedRanks is true)
  const selectedRank = !allowMixedRanks && selectedCards.length > 0 ? selectedCards[0].rank : null
  const canSelect = (card: CardType) => {
    if (!onCardClick) return false
    if (!isPlayable(card)) return false
    if (selectedRank && card.rank !== selectedRank) return false
    return true
  }

  return (
    <div className={className}>
      {title && <h3 className="text-lg font-semibold mb-2 text-white">{title}</h3>}
      <div className="flex gap-2 overflow-x-auto py-2 px-1">
        {sortedCards.map((card, index) => (
          <div key={`${card.rank}-${card.suit}-${index}`} className="flex-shrink-0">
            <Card
              card={card}
              size={size}
              selectable={canSelect(card)}
              selected={isSelected(card)}
              playable={isPlayable(card)}
              dimmed={!canSelect(card)}
              onClick={() => onCardClick?.(card)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
