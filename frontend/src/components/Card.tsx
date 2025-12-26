import type { Card as CardType } from '@hilo/shared'

interface CardProps {
  card: CardType
  size?: 'small' | 'medium' | 'large'
  faceDown?: boolean
  selectable?: boolean
  selected?: boolean
  playable?: boolean
  dimmed?: boolean
  onClick?: () => void
}

const suitSymbols: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
}

const suitColors: Record<string, string> = {
  hearts: 'text-red-600',
  diamonds: 'text-red-600',
  clubs: 'text-gray-900',
  spades: 'text-gray-900',
}

export function Card({
  card,
  size = 'medium',
  faceDown = false,
  selectable = false,
  selected = false,
  playable = false,
  dimmed = false,
  onClick,
}: CardProps) {
  const suitSymbol = suitSymbols[card.suit] || card.suit
  const suitColor = suitColors[card.suit] || 'text-gray-900'

  // Base classes
  const baseClasses = 'relative bg-white border-2 rounded-lg flex flex-col items-center justify-center font-bold shadow-md transition-all duration-200'

  // Size classes
  const sizeClasses = {
    small: 'w-12 h-16 text-sm',
    medium: 'w-16 h-24 text-lg',
    large: 'w-24 h-32 text-2xl',
  }

  // State classes
  const dimmedClass = dimmed ? 'opacity-40 cursor-not-allowed' : ''
  const selectableClass = selectable ? 'cursor-pointer hover:-translate-y-2 hover:shadow-lg' : ''
  const selectedClass = selected ? 'border-blue-500 bg-blue-50 -translate-y-2 shadow-xl' : 'border-gray-800'
  const playableClass = playable && selectable ? 'animate-pulse-green' : ''
  const faceDownClass = faceDown ? 'bg-gradient-to-br from-blue-700 to-blue-900 border-blue-900' : ''

  const className = [
    baseClasses,
    sizeClasses[size],
    selectableClass,
    selectedClass,
    playableClass,
    dimmedClass,
    faceDownClass,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className} onClick={selectable ? onClick : undefined}>
      {faceDown ? (
        <div className="w-4/5 h-4/5 bg-blue-500 rounded" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, #3b82f6, #3b82f6 10px, #1e40af 10px, #1e40af 20px)',
        }}></div>
      ) : (
        <>
          <div className={`${suitColor} leading-none`}>{card.rank}</div>
          <div className={`${suitColor} text-xl mt-1`}>{suitSymbol}</div>
        </>
      )}
    </div>
  )
}
