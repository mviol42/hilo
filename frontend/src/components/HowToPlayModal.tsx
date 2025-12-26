interface HowToPlayModalProps {
  isOpen: boolean
  onClose: () => void
}

export function HowToPlayModal({ isOpen, onClose }: HowToPlayModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white p-6 flex justify-between items-center">
          <h2 className="text-3xl font-bold">How to Play Hi-Lo</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-2xl font-bold w-8 h-8 flex items-center justify-center"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-5rem)]">
          <div className="space-y-6">
            {/* Objective */}
            <section>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Objective</h3>
              <p className="text-gray-700">
                Hi-Lo is a turn-based card game where each player aims to play all of their cards before the other players.
              </p>
            </section>

            {/* Setup */}
            <section>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Setup</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li>Uses 1 standard 52-card deck for every 4 players (no jokers)</li>
                <li>Each player is dealt 9 cards:
                  <ul className="list-circle list-inside ml-6 mt-1 space-y-1">
                    <li>3 <strong>facedown</strong> cards (hidden from everyone)</li>
                    <li>3 <strong>faceup</strong> cards (visible to all players)</li>
                    <li>3 cards in your <strong>hand</strong> (visible only to you)</li>
                  </ul>
                </li>
                <li>The remaining cards form the deck</li>
              </ul>
            </section>

            {/* Card Ranks */}
            <section>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Card Rules</h3>
              <div className="space-y-2 text-gray-700">
                <p><strong>Special Cards (always playable):</strong> 2, 8, 10</p>
                <p><strong>Regular Cards:</strong></p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>8s on top of the pile are "invisible" - ignore them when checking playability</li>
                  <li>If pile is empty, any rank is playable</li>
                  <li>If top card is 7 or lower: play cards ≤ 7</li>
                  <li>If top card is higher than 7: play cards ≥ top card rank</li>
                </ul>
                <p className="mt-2"><strong>Rank order (low to high):</strong> 3, 4, 5, 6, 7, 9, J, Q, K, A</p>
              </div>
            </section>

            {/* Gameplay */}
            <section>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Gameplay</h3>
              <div className="space-y-3 text-gray-700">
                <div>
                  <p className="font-semibold">First Turn:</p>
                  <p>The player with the lowest non-special card goes first and plays one or more of that rank.</p>
                </div>

                <div>
                  <p className="font-semibold">On Your Turn:</p>
                  <ul className="list-disc list-inside ml-4 space-y-1">
                    <li>If you have hand cards: play a playable card or pick up the pile if you can't play</li>
                    <li>If your hand is empty: play from faceup cards or pick up the pile (plus a faceup card)</li>
                    <li>If hand and faceup cards are empty: flip a facedown card. If playable, play it; if not, pick up the pile and the card</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold">After Playing:</p>
                  <ul className="list-disc list-inside ml-4 space-y-1">
                    <li>Draw from the deck until you have 3 cards in hand (if the deck has cards)</li>
                    <li>If you emptied your hand by playing, you may also play matching faceup cards as a bonus</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Special Actions */}
            <section>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Blow Up the Pile</h3>
              <p className="text-gray-700 mb-2">The pile is discarded and you get another turn if:</p>
              <ul className="list-disc list-inside ml-4 space-y-1 text-gray-700">
                <li>You play a 10</li>
                <li>The top 4 cards of the pile are the same rank</li>
              </ul>
            </section>

            {/* Winning */}
            <section>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Winning</h3>
              <p className="text-gray-700">
                The first player to play all their cards wins the game!
              </p>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 p-4 flex justify-end border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  )
}
