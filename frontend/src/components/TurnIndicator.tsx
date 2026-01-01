import type { PlayerId } from '@hilo/shared'

interface TurnIndicatorProps {
  activePlayerId: PlayerId
  turnOrder: PlayerId[]
  playerNames: { [playerId: string]: string }
  currentPlayerId: PlayerId // The viewing player's ID
}

function TriangleIcon({ className }: { className?: string }) {
  return (
    <div className="relative w-6 overflow-hidden">
      <svg
        className={`${className} animate-slide-fade`}
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          animation: 'slideFade 2s ease-in-out infinite',
        }}
      >
        <path
          d="M2.5 1.5C1.5 0.9 0.5 1.6 0.5 2.8V9.2C0.5 10.4 1.5 11.1 2.5 10.5L8.5 7.3C9.5 6.7 9.5 5.3 8.5 4.7L2.5 1.5Z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <style>{`
        @keyframes slideFade {
          0% {
            transform: translateX(0px);
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            transform: translateX(8px);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}

export function TurnIndicator({
  activePlayerId,
  turnOrder,
  playerNames,
  currentPlayerId,
}: TurnIndicatorProps) {
  // Find the index of the active player
  const activeIndex = turnOrder.indexOf(activePlayerId)
  if (activeIndex === -1) {
    return null
  }

  // Calculate the next player (on deck)
  const nextIndex = (activeIndex + 1) % turnOrder.length
  const nextPlayerId = turnOrder[nextIndex]

  // Get display text, using "Your Turn" for the current player
  const activeText = activePlayerId === currentPlayerId
    ? 'Your Turn'
    : `${playerNames[activePlayerId] || `Player ${activePlayerId.substring(0, 8)}`}'s Turn`

  const nextText = nextPlayerId === currentPlayerId
    ? 'Your Turn'
    : `${playerNames[nextPlayerId] || `Player ${nextPlayerId.substring(0, 8)}`}'s Turn`

  return (
    <div className="flex items-center justify-center gap-2 text-lg">
      <span className="text-white font-semibold">{activeText}</span>
      <TriangleIcon className="text-gray-400" />
      <span className="text-gray-400">{nextText}</span>
    </div>
  )
}
