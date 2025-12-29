# Task 7: Game Page

## Goal

Implement the game page for playing Hi-Lo, including setup phase (selecting face-up cards) and playing phase (turn-based card play).

## Prerequisites

- Task 1: Project Setup completed
- Task 2: Routing completed
- Task 3: API Client completed
- Task 4: State Management completed
- Task 8: Shared Components (Card, Button, etc.)

## UI Requirements (from frontend-design.md)

### Setup Phase
- Display 6 cards in hand at bottom of screen
- 3 empty slots above for face-up card selection
- Cards are selectable
- When card clicked, moves to next available slot
- Cards in slots are clickable (return to hand)
- When 3 slots full, hand cards not selectable
- Confirm button greyed out until 3 slots full
- Confirm button blue and clickable when 3 slots full

### Playing Phase - Layout
- **Hand**: Bottom 1/10 of screen, scrollable if needed, sorted by rank
- **Face-up Pile**: Toggle view with "Show/Hide face up cards" button
- **Pile**: Shared pile visible to all
- **Other Players**: Display card counts and face-up cards
- **Face-down cards**: Hidden count, generic card backing

### Playing Phase - Interaction
- **Active Player**: Can see playable cards highlighted green
- **Green Highlight Animation**: 2s fade in, 2s fade out, repeating
- **Card Selection**: Click to select/deselect
- **Same Rank Only**: After selecting first card, only same rank highlighted
- **Submit Button**: Play selected cards to pile
- **Unplayable Cards**: Not highlighted, not selectable

### Animations (Text Overlays)
- **Bonus Play**: Blue text, small → large → fade
- **Exploded! Play Again**: Green text, small → large → fade
- **No Plays Available**: Red text, small → large → fade

## Implementation

### 1. Create Game Page Component

Create `src/pages/GamePage/index.tsx`:
```typescript
import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { apiClient } from '@/services/api'
import { socketManager } from '@/services/socket'
import { usePlayer, useGame, useUI } from '@/context'
import { SetupPhase } from './SetupPhase'
import { PlayingPhase } from './PlayingPhase'
import { GameOverModal } from './GameOverModal'
import './GamePage.css'

export function GamePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const gameId = searchParams.get('id')

  const { playerId } = usePlayer()
  const { gameState, dispatch: gameDispatch } = useGame()
  const { showToast } = useUI()

  const [showGameOver, setShowGameOver] = useState(false)
  const [winner, setWinner] = useState<{ id: string; name: string } | null>(null)

  // Redirect if no game ID
  useEffect(() => {
    if (!gameId) {
      navigate('/')
    }
  }, [gameId, navigate])

  // Listen for game events
  useEffect(() => {
    const cleanupPileBlown = socketManager.onGamePileBlown((data) => {
      // Show pile blown animation
      gameDispatch({ type: 'PILE_BLOWN', payload: data })

      const message = data.reason === 'ten' ? 'Exploded! Play again' : 'Four of a kind! Play again'
      showToast(message, 'success')
    })

    const cleanupPlayerWon = socketManager.onGamePlayerWon((data) => {
      // Show game over modal
      setWinner({ id: data.winnerId, name: data.winnerName })
      setShowGameOver(true)
    })

    return () => {
      cleanupPileBlown()
      cleanupPlayerWon()
    }
  }, [gameDispatch, showToast])

  if (!gameId || !gameState) {
    return (
      <div className="game-page loading">
        <p>Loading game...</p>
      </div>
    )
  }

  const handleReturnToLobby = () => {
    navigate('/')
  }

  return (
    <div className="game-page">
      {gameState.phase === 'setup' ? (
        <SetupPhase gameId={gameId} playerId={playerId} />
      ) : (
        <PlayingPhase gameId={gameId} playerId={playerId} />
      )}

      {showGameOver && winner && (
        <GameOverModal
          winner={winner}
          isWinner={winner.id === playerId}
          onClose={handleReturnToLobby}
        />
      )}
    </div>
  )
}
```

### 2. Create Setup Phase Component

Create `src/pages/GamePage/SetupPhase.tsx`:
```typescript
import { useState } from 'react'
import { apiClient } from '@/services/api'
import { useGame, useUI } from '@/context'
import { Card as CardType } from '@hilo/shared'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import './SetupPhase.css'

interface SetupPhaseProps {
  gameId: string
  playerId: string
}

export function SetupPhase({ gameId, playerId }: SetupPhaseProps) {
  const { gameState, dispatch: gameDispatch } = useGame()
  const { showToast, setIsLoading } = useUI()

  const [selectedForFaceUp, setSelectedForFaceUp] = useState<CardType[]>([])

  if (!gameState) return null

  const handleCardClick = (card: CardType) => {
    const isInSlots = selectedForFaceUp.some(
      (c) => c.rank === card.rank && c.suit === card.suit
    )

    if (isInSlots) {
      // Remove from slots, return to hand
      setSelectedForFaceUp(selectedForFaceUp.filter(
        (c) => !(c.rank === card.rank && c.suit === card.suit)
      ))
    } else {
      // Add to slots if not full
      if (selectedForFaceUp.length < 3) {
        setSelectedForFaceUp([...selectedForFaceUp, card])
      }
    }
  }

  const handleConfirm = async () => {
    if (selectedForFaceUp.length !== 3) return

    try {
      setIsLoading(true)
      await apiClient.selectFaceUp({
        gameId,
        playerId,
        cards: selectedForFaceUp,
      })
      showToast('Face-up cards selected!', 'success')
    } catch (error: any) {
      console.error('Failed to select face-up cards:', error)
      showToast('Failed to select cards', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const canConfirm = selectedForFaceUp.length === 3
  const slotsFull = selectedForFaceUp.length === 3

  // Sort hand by rank
  const sortedHand = [...gameState.myHand].sort((a, b) => {
    const rankOrder = '23456789TJQKA'
    return rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank)
  })

  return (
    <div className="setup-phase">
      <div className="setup-header">
        <h2>Setup Phase</h2>
        <p>Select 3 cards for your face-up pile</p>
      </div>

      <div className="setup-content">
        {/* Face-up Slots */}
        <div className="faceup-slots">
          {[0, 1, 2].map((index) => (
            <div key={index} className="card-slot">
              {selectedForFaceUp[index] ? (
                <Card
                  card={selectedForFaceUp[index]}
                  onClick={() => handleCardClick(selectedForFaceUp[index])}
                  selectable
                />
              ) : (
                <div className="empty-slot">Slot {index + 1}</div>
              )}
            </div>
          ))}
        </div>

        {/* Confirm Button */}
        <div className="confirm-section">
          <Button
            onClick={handleConfirm}
            variant="primary"
            size="large"
            disabled={!canConfirm}
          >
            Confirm Selection
          </Button>
        </div>

        {/* Hand */}
        <div className="hand-zone">
          <h3>Your Hand</h3>
          <div className="card-list">
            {sortedHand.map((card, index) => {
              const isInSlots = selectedForFaceUp.some(
                (c) => c.rank === card.rank && c.suit === card.suit
              )
              const canSelect = !slotsFull || isInSlots

              return (
                <Card
                  key={`${card.rank}-${card.suit}-${index}`}
                  card={card}
                  onClick={() => canSelect && handleCardClick(card)}
                  selectable={canSelect}
                  dimmed={!canSelect}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
```

### 3. Create Playing Phase Component

Create `src/pages/GamePage/PlayingPhase.tsx`:
```typescript
import { useState, useEffect } from 'react'
import { apiClient } from '@/services/api'
import { usePlayer, useGame, useUI } from '@/context'
import { Card as CardType } from '@hilo/shared'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { OtherPlayers } from './OtherPlayers'
import { Pile } from './Pile'
import './PlayingPhase.css'

interface PlayingPhaseProps {
  gameId: string
  playerId: string
}

export function PlayingPhase({ gameId, playerId }: PlayingPhaseProps) {
  const { gameState, selectedCards, showFaceUp, dispatch: gameDispatch } = useGame()
  const { showToast, setIsLoading } = useUI()

  const [showAnimation, setShowAnimation] = useState<{
    type: 'bonus' | 'exploded' | 'no_plays'
    text: string
  } | null>(null)

  if (!gameState) return null

  const isMyTurn = gameState.activePlayerId === playerId
  const hasHand = gameState.myHand.length > 0

  // Sort hand by rank
  const sortedHand = [...gameState.myHand].sort((a, b) => {
    const rankOrder = '23456789TJQKA'
    return rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank)
  })

  const handleCardClick = (card: CardType) => {
    if (!isMyTurn) return

    // Check if card is playable
    const isPlayable = gameState.playableCards?.some(
      (c) => c.rank === card.rank && c.suit === card.suit
    )

    if (!isPlayable) return

    gameDispatch({ type: 'TOGGLE_CARD_SELECTION', payload: card })
  }

  const handleSubmit = async () => {
    if (selectedCards.length === 0) return

    try {
      setIsLoading(true)
      const response = await apiClient.playCards({
        gameId,
        playerId,
        cards: selectedCards,
      })

      if (response.blowUp) {
        setShowAnimation({ type: 'exploded', text: 'Exploded! Play again' })
        setTimeout(() => setShowAnimation(null), 3000)
      }

      // Clear selection
      gameDispatch({ type: 'CLEAR_SELECTION' })
      showToast('Cards played!', 'success')
    } catch (error: any) {
      console.error('Failed to play cards:', error)
      showToast('Failed to play cards', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePickUpPile = async () => {
    try {
      setIsLoading(true)
      await apiClient.pickUpPile({
        gameId,
        playerId,
      })

      setShowAnimation({ type: 'no_plays', text: 'No plays available' })
      setTimeout(() => setShowAnimation(null), 3000)

      showToast('Picked up pile', 'info')
    } catch (error: any) {
      console.error('Failed to pick up pile:', error)
      showToast('Failed to pick up pile', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleFaceUp = () => {
    gameDispatch({ type: 'TOGGLE_FACE_UP' })
  }

  // Determine which cards can be selected (same rank as first selected card)
  const selectedRank = selectedCards.length > 0 ? selectedCards[0].rank : null

  return (
    <div className="playing-phase">
      {/* Animation Overlay */}
      {showAnimation && (
        <div className={`animation-overlay animation-${showAnimation.type}`}>
          <div className="animation-text">{showAnimation.text}</div>
        </div>
      )}

      {/* Top Section: Other Players and Pile */}
      <div className="top-section">
        <OtherPlayers players={gameState.otherPlayers} />
        <Pile cards={gameState.pile} />
      </div>

      {/* Middle Section: Face-up cards (when shown) */}
      {showFaceUp && (
        <div className="faceup-section">
          <h3>Your Face-up Cards</h3>
          <div className="card-list">
            {gameState.myFaceUp.map((card, index) => {
              const isPlayable = isMyTurn && gameState.playableCards?.some(
                (c) => c.rank === card.rank && c.suit === card.suit
              )
              const canSelect = isPlayable && (!selectedRank || selectedRank === card.rank)

              return (
                <Card
                  key={`${card.rank}-${card.suit}-${index}`}
                  card={card}
                  onClick={() => canSelect && handleCardClick(card)}
                  selectable={canSelect}
                  playable={isPlayable}
                  selected={selectedCards.some(c => c.rank === card.rank && c.suit === card.suit)}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Bottom Section: Hand */}
      <div className="bottom-section">
        {/* Controls */}
        <div className="controls">
          {hasHand && (
            <Button onClick={handleToggleFaceUp} variant="secondary">
              {showFaceUp ? 'Hide Face-up Cards' : 'Show Face-up Cards'}
            </Button>
          )}

          {isMyTurn && (
            <>
              <Button
                onClick={handleSubmit}
                variant="primary"
                disabled={selectedCards.length === 0}
              >
                Submit ({selectedCards.length})
              </Button>

              {gameState.playableCards && gameState.playableCards.length === 0 && (
                <Button onClick={handlePickUpPile} variant="danger">
                  Pick Up Pile
                </Button>
              )}
            </>
          )}
        </div>

        {/* Hand */}
        {!showFaceUp && hasHand && (
          <div className="hand-zone">
            <div className="card-list scrollable">
              {sortedHand.map((card, index) => {
                const isPlayable = isMyTurn && gameState.playableCards?.some(
                  (c) => c.rank === card.rank && c.suit === card.suit
                )
                const canSelect = isPlayable && (!selectedRank || selectedRank === card.rank)
                const isSelected = selectedCards.some(c => c.rank === card.rank && c.suit === card.suit)

                return (
                  <Card
                    key={`${card.rank}-${card.suit}-${index}`}
                    card={card}
                    onClick={() => canSelect && handleCardClick(card)}
                    selectable={canSelect}
                    playable={isPlayable}
                    selected={isSelected}
                  />
                )
              })}
            </div>
          </div>
        )}

        {/* Turn Indicator */}
        <div className="turn-indicator">
          {isMyTurn ? (
            <p className="my-turn">Your Turn</p>
          ) : (
            <p className="waiting">Waiting for other players...</p>
          )}
        </div>
      </div>
    </div>
  )
}
```

### 4. Create Supporting Components

Create `src/pages/GamePage/OtherPlayers.tsx`:
```typescript
import { Card } from '@/components/Card'
import './OtherPlayers.css'

interface OtherPlayersProps {
  players: {
    [playerId: string]: {
      handCount: number
      faceUp: any[]
      faceDownCount: number
    }
  }
}

export function OtherPlayers({ players }: OtherPlayersProps) {
  return (
    <div className="other-players">
      {Object.entries(players).map(([playerId, player]) => (
        <div key={playerId} className="other-player">
          <div className="player-name">
            {playerId.substring(0, 8)}
          </div>
          <div className="player-cards">
            <div className="card-count">Hand: {player.handCount}</div>
            <div className="faceup-cards">
              {player.faceUp.map((card, index) => (
                <Card key={index} card={card} size="small" />
              ))}
            </div>
            <div className="card-count">Face-down: {player.faceDownCount}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
```

Create `src/pages/GamePage/Pile.tsx`:
```typescript
import { Card as CardType } from '@hilo/shared'
import { Card } from '@/components/Card'
import './Pile.css'

interface PileProps {
  cards: CardType[]
}

export function Pile({ cards }: PileProps) {
  const topCard = cards.length > 0 ? cards[cards.length - 1] : null

  return (
    <div className="pile-zone">
      <h3>Pile ({cards.length})</h3>
      <div className="pile-cards">
        {topCard ? (
          <Card card={topCard} size="large" />
        ) : (
          <div className="empty-pile">Empty</div>
        )}
      </div>
    </div>
  )
}
```

Create `src/pages/GamePage/GameOverModal.tsx`:
```typescript
import { Button } from '@/components/Button'
import './GameOverModal.css'

interface GameOverModalProps {
  winner: { id: string; name: string }
  isWinner: boolean
  onClose: () => void
}

export function GameOverModal({ winner, isWinner, onClose }: GameOverModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{isWinner ? 'You Won!' : 'Game Over'}</h2>
        <p>
          {isWinner
            ? 'Congratulations! You played all your cards!'
            : `${winner.name} won the game!`}
        </p>
        <Button onClick={onClose} variant="primary" size="large">
          Return to Lobby
        </Button>
      </div>
    </div>
  )
}
```

## Styling Files

Create corresponding CSS files for all components with animations for:
- Green pulsing highlight for playable cards (2s fade in/out)
- Text animations (small → large → fade)
- Card selection states
- Responsive layout

## API Integration

### Setup Phase
- `POST /api/game/select-faceup` - Select 3 face-up cards

### Playing Phase
- `POST /api/game/play-cards` - Play selected cards
- `POST /api/game/pickup-pile` - Pick up pile when no playable cards

## Testing

Create comprehensive tests for:
- Card selection logic
- Playability validation
- Setup phase flow
- Playing phase interactions

## Output Files

- `/frontend/src/pages/GamePage/index.tsx` - Main game page
- `/frontend/src/pages/GamePage/SetupPhase.tsx` - Setup phase component
- `/frontend/src/pages/GamePage/PlayingPhase.tsx` - Playing phase component
- `/frontend/src/pages/GamePage/OtherPlayers.tsx` - Other players display
- `/frontend/src/pages/GamePage/Pile.tsx` - Pile display
- `/frontend/src/pages/GamePage/GameOverModal.tsx` - Game over modal
- CSS files for all components

## Next Steps

- Task 8: Create reusable Card component
- Task 9: Integration and polish

## Notes

- Hand zone is 1/10 of screen height (10vh)
- Cards sorted by rank (2-A)
- Green highlight animation for playable cards only when player's turn
- Selected cards highlighted with different color
- Face-up/face-down toggle only available when hand is not empty
- WebSocket events update game state automatically
- Animations use CSS keyframes for smooth transitions
