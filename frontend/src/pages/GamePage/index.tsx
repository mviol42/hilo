import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import type { Card as CardType } from '@hilo/shared'
import { apiClient } from '@/services/api'
import { usePlayer, useGame, useUI } from '@/context'
import { Card, Hand, Button } from '@/components'

export function GamePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const gameId = searchParams.get('id')

  const { playerId } = usePlayer()
  const { gameState, selectedCards, showFaceUp, lastEvent, dispatch: gameDispatch } = useGame()
  const { showToast, setIsLoading } = useUI()

  const [setupSelectedCards, setSetupSelectedCards] = useState<CardType[]>([])
  const [animationMessage, setAnimationMessage] = useState<{
    text: string
    color: string
  } | null>(null)
  const [slideAnimation, setSlideAnimation] = useState<'top' | 'bottom' | null>(null)
  const [revealedCard, setRevealedCard] = useState<{
    card: CardType
    outcome: 'pile' | 'pickup'
  } | null>(null)

  // Redirect if no game ID and fetch initial game state
  useEffect(() => {
    if (!gameId) {
      navigate('/')
      return
    }

    // Fetch initial game state if not already loaded
    // This handles the case where the user navigates directly to the game page
    // or refreshes during a game
    if (!gameState) {
      const fetchGameState = async () => {
        try {
          // The game state will be received via WebSocket events
          // For now, we'll wait for the WebSocket to provide it
          // Alternatively, we could add a GET endpoint to fetch current game state
        } catch (error) {
          console.error('Failed to load game state:', error)
          showToast('Failed to load game', 'error')
        }
      }
      fetchGameState()
    }
  }, [gameId, navigate, gameState, showToast])

  // Handle game events for animations
  useEffect(() => {
    if (lastEvent.type === 'pile_blown') {
      const reason = lastEvent.data.reason
      if (reason === 'ten') {
        showAnimation('Exploded! Play again', 'text-green-500')
      } else if (reason === 'four_of_kind') {
        showAnimation('Bonus play!', 'text-blue-500')
      }
      setTimeout(() => gameDispatch({ type: 'CLEAR_LAST_EVENT' }), 2000)
    } else if (lastEvent.type === 'player_won') {
      const winnerName = lastEvent.data.winnerName
      showAnimation(`${winnerName} won!`, 'text-yellow-500')
    }
  }, [lastEvent, gameDispatch])

  const showAnimation = (text: string, color: string) => {
    setAnimationMessage({ text, color })
    setTimeout(() => setAnimationMessage(null), 2000)
  }

  // SETUP PHASE: Select face-up cards
  const handleSetupCardClick = (card: CardType) => {
    const isSelected = setupSelectedCards.some(c => c.rank === card.rank && c.suit === card.suit)

    if (isSelected) {
      // Deselect card
      setSetupSelectedCards(prev => prev.filter(c => !(c.rank === card.rank && c.suit === card.suit)))
    } else if (setupSelectedCards.length < 3) {
      // Select card
      setSetupSelectedCards(prev => [...prev, card])
    }
  }

  const handleSetupConfirm = async () => {
    if (!gameId || !playerId || setupSelectedCards.length !== 3) return

    console.log('[GamePage] handleSetupConfirm - gameId:', gameId?.substring(0, 8), 'playerId:', playerId?.substring(0, 8))

    try {
      setIsLoading(true)
      const response = await apiClient.selectFaceUp({
        gameId,
        playerId,
        cards: setupSelectedCards,
      })
      gameDispatch({ type: 'SET_GAME_STATE', payload: response.gameState })
      setSetupSelectedCards([])
      showToast('Face-up cards selected!', 'success')
    } catch (error: any) {
      console.error('[GamePage] Failed to select face-up cards:', error)
      console.error('[GamePage] Error details:', {
        status: error.response?.status,
        message: error.response?.data?.message,
        gameId: gameId?.substring(0, 8),
        playerId: playerId?.substring(0, 8),
      })
      showToast(error.response?.data?.message || 'Failed to select face-up cards', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // TURN PLAY: Play cards
  const handlePlayCardClick = (card: CardType) => {
    gameDispatch({ type: 'TOGGLE_CARD_SELECTION', payload: card })
  }

  const handleSubmitPlay = async () => {
    if (!gameId || !playerId || selectedCards.length === 0) return

    try {
      setIsLoading(true)
      const response = await apiClient.playCards({
        gameId,
        playerId,
        cards: selectedCards,
      })
      gameDispatch({ type: 'SET_GAME_STATE', payload: response.gameState })
      gameDispatch({ type: 'CLEAR_SELECTION' })

      if (response.blowUp) {
        showAnimation('Pile cleared!', 'text-green-500')
      }
      if (response.winner) {
        showAnimation('You won!', 'text-yellow-500')
      }
    } catch (error: any) {
      console.error('Failed to play cards:', error)
      const message = error.response?.data?.message || 'Failed to play cards'
      showToast(message, 'error')
      if (message.includes('No plays available')) {
        showAnimation('No plays available', 'text-red-500')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handlePickUpPile = async () => {
    if (!gameId || !playerId) return

    try {
      setIsLoading(true)
      const response = await apiClient.pickUpPile({
        gameId,
        playerId,
      })
      gameDispatch({ type: 'SET_GAME_STATE', payload: response.gameState })
      showToast('Picked up pile', 'info')
    } catch (error: any) {
      console.error('Failed to pick up pile:', error)
      showToast('Failed to pick up pile', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleFaceUp = () => {
    // Set animation direction based on current state
    // If currently showing face up, hand will slide in from bottom
    // If currently showing hand, face up will slide in from top
    setSlideAnimation(showFaceUp ? 'bottom' : 'top')
    gameDispatch({ type: 'TOGGLE_FACE_UP' })

    // Clear animation class after animation completes
    setTimeout(() => setSlideAnimation(null), 400)
  }

  const handleFaceDownCardClick = async (index: number) => {
    if (!gameId || !playerId) return

    try {
      setIsLoading(true)
      const response = await apiClient.playCards({
        gameId,
        playerId,
        cards: [],
        faceDownIndex: index,
      })

      // Show the revealed card with animation
      if (response.cardsPlayed && response.cardsPlayed.length > 0) {
        const revealedCardData = response.cardsPlayed[0]

        // Determine outcome based on whether player picked up pile
        // If the player's hand increased significantly, they picked up the pile
        const oldHandSize = gameState?.myHand.length || 0
        const newHandSize = response.gameState.myHand.length
        const pickedUpPile = newHandSize > oldHandSize + 1 // More than just drawing a card

        setRevealedCard({
          card: revealedCardData,
          outcome: pickedUpPile ? 'pickup' : 'pile'
        })

        // Wait for reveal animation (0.8s) + outcome animation (0.5s)
        await new Promise(resolve => setTimeout(resolve, 1300))
        setRevealedCard(null)
      }

      // Update game state after animation
      gameDispatch({ type: 'SET_GAME_STATE', payload: response.gameState })

      // Don't show additional animations - the reveal already showed the outcome
      // Winner animation is still important though
      if (response.winner) {
        showAnimation('You won!', 'text-yellow-500')
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to play card'
      showToast(message, 'error')
      setRevealedCard(null)
    } finally {
      setIsLoading(false)
    }
  }

  if (!gameId) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">No game ID</h1>
          <Button onClick={() => navigate('/')} variant="primary">
            Return to Home
          </Button>
        </div>
      </div>
    )
  }

  if (!gameState) {
    console.log('[GamePage] Waiting for game state, gameId:', gameId)
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Loading game...</h1>
          <p className="text-gray-400 mb-4">Waiting for game state from server</p>
          <p className="text-sm text-gray-500">Game ID: {gameId.substring(0, 8)}...</p>
        </div>
      </div>
    )
  }

  console.log('[GamePage] Rendering game state:', {
    gameId,
    phase: gameState.phase,
    activePlayerId: gameState.activePlayerId,
    isMyTurn: gameState.activePlayerId === playerId,
  })

  const isMyTurn = gameState.activePlayerId === playerId
  const isSetupPhase = gameState.phase === 'setup'
  const hasSelectedFaceUp = gameState.myFaceUp.length === 3
  const isGameEnded = gameState.phase === 'ended'

  // GAME ENDED
  if (isGameEnded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-5xl font-bold mb-4">
            {gameState.winner === playerId ? '🎉 You Won!' : 'Game Over'}
          </h1>
          {gameState.winner && gameState.winner !== playerId && (
            <p className="text-2xl text-gray-300 mb-8">
              {gameState.winnerName || `Player ${gameState.winner.substring(0, 8)}`} won!
            </p>
          )}
          <Button onClick={() => navigate('/')} variant="primary" size="large">
            Return to Menu
          </Button>
        </div>
      </div>
    )
  }

  // SETUP PHASE RENDER - Waiting for your turn to select faceup
  if (isSetupPhase && !isMyTurn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Setup Phase</h1>
          <p className="text-gray-300">Waiting for other players to select their face-up cards...</p>
        </div>
      </div>
    )
  }

  // SETUP PHASE RENDER - Your turn to select faceup
  if (isSetupPhase && isMyTurn && !hasSelectedFaceUp) {
    const availableCards = gameState.myHand
    const canConfirm = setupSelectedCards.length === 3

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Setup Phase</h1>
            <p className="text-gray-300">Select 3 cards for your face-up pile</p>
          </div>

          {/* Card Slots */}
          <div className="flex justify-center gap-4 mb-8">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="w-24 h-32 border-2 border-dashed border-gray-500 rounded-lg flex items-center justify-center bg-gray-800/50"
              >
                {setupSelectedCards[index] ? (
                  <Card
                    card={setupSelectedCards[index]}
                    size="large"
                    selectable
                    onClick={() => handleSetupCardClick(setupSelectedCards[index])}
                  />
                ) : (
                  <span className="text-gray-500 text-4xl">?</span>
                )}
              </div>
            ))}
          </div>

          {/* Confirm Button */}
          <div className="flex justify-center mb-8">
            <Button
              onClick={handleSetupConfirm}
              variant="primary"
              size="large"
              disabled={!canConfirm}
            >
              Confirm Selection
            </Button>
          </div>

          {/* Hand */}
          <Hand
            cards={availableCards}
            selectedCards={setupSelectedCards}
            playableCards={availableCards}
            onCardClick={handleSetupCardClick}
            title="Your Hand - Select any 3 cards"
            size="medium"
            className="bg-gray-800/50 rounded-lg p-4"
            allowMixedRanks={true}
          />
        </div>
      </div>
    )
  }

  // TURN PLAY PHASE RENDER
  // Determine which cards to display based on what's available
  const getAvailableCards = () => {
    if (gameState.myHand.length > 0) {
      return showFaceUp ? gameState.myFaceUp : gameState.myHand
    } else if (gameState.myFaceUp.length > 0) {
      return gameState.myFaceUp
    } else {
      // Playing from facedown cards
      return []
    }
  }

  const cardsToDisplay = getAvailableCards()
  const playableCards = isMyTurn ? gameState.playableCards || [] : []
  const isPlayingFaceDown = gameState.myHand.length === 0 && gameState.myFaceUp.length === 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-4">
      {/* Animation Message */}
      {animationMessage && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
          <div className={`${animationMessage.color} text-6xl font-bold animate-text-grow`}>
            {animationMessage.text}
          </div>
        </div>
      )}

      {/* Revealed Card Animation */}
      {revealedCard && (
        <div className="fixed inset-0 flex flex-col items-center justify-center pointer-events-none z-50 bg-black/50">
          <div className="flex flex-col items-center gap-4">
            <div className="text-2xl font-bold text-white mb-4">
              You played:
            </div>
            <div className="animate-card-reveal">
              <Card card={revealedCard.card} size="large" />
            </div>
            <div className={`text-xl font-semibold mt-4 ${
              revealedCard.outcome === 'pile' ? 'text-green-400' : 'text-orange-400'
            }`}>
              {revealedCard.outcome === 'pile' ? 'Added to pile!' : 'Pick up the pile!'}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold">
            {isMyTurn ? "Your Turn" : "Waiting..."}
          </h1>
          <p className="text-gray-300 text-sm">Game ID: {gameId.substring(0, 8)}...</p>
        </div>

        {/* Pile Info */}
        <div className="bg-gray-800/50 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-400">Deck: {gameState.deckCount} cards</p>
              <p className="text-sm text-gray-400">Pile: {gameState.pile.length} cards</p>
            </div>
            <div className="flex gap-2">
              {gameState.pile.slice(-3).map((card, index) => (
                <Card key={index} card={card} size="small" />
              ))}
            </div>
          </div>
        </div>

        {/* Other Players */}
        <div className="bg-gray-800/50 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-2">Other Players</h2>
          {Object.entries(gameState.otherPlayers).map(([pid, player]) => (
            <div key={pid} className="flex justify-between items-center mb-2">
              <span className="text-gray-300">{player.name}</span>
              <div className="flex gap-1">
                <span className="text-sm text-gray-400">Hand: {player.handCount}</span>
                <span className="text-sm text-gray-400">Face-up: {player.faceUp.length}</span>
                <span className="text-sm text-gray-400">Face-down: {player.faceDownCount}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Toggle Button - only show if player has hand cards */}
        {(gameState.myHand.length > 0 && gameState.myFaceUp.length > 0) &&  (
          <div className="flex justify-center">
            <Button onClick={handleToggleFaceUp} variant="secondary">
              {showFaceUp ? 'Show Hand' : 'Show Face Up Cards'}
            </Button>
          </div>
        )}

        {/* Player's Cards */}
        {!isPlayingFaceDown && cardsToDisplay.length > 0 && (
          <Hand
            cards={cardsToDisplay}
            selectedCards={selectedCards}
            playableCards={playableCards}
            onCardClick={isMyTurn ? handlePlayCardClick : undefined}
            title={
              gameState.myHand.length > 0
                ? showFaceUp
                  ? 'Your Face-Up Cards'
                  : 'Your Hand'
                : 'Your Face-Up Cards'
            }
            size="medium"
            className={`bg-gray-800/50 rounded-lg p-4 ${
              slideAnimation === 'top' ? 'animate-slide-in-from-top' :
              slideAnimation === 'bottom' ? 'animate-slide-in-from-bottom' : ''
            }`}
          />
        )}

        {/* Facedown Cards */}
        {isPlayingFaceDown && gameState.myFaceDownCount > 0 && (
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-2 text-white">Your Face-Down Cards</h3>
            <div className="flex gap-2 justify-center">
              {gameState.myFaceDownPlayed.map((isPlayed: boolean, index: number) => (
                <div key={index} className="flex flex-col items-center gap-2">
                  {!isPlayed && (
                    <Card
                      card={{ rank: '2', suit: 'hearts' }} // Dummy card, will be shown facedown
                      size="medium"
                      faceDown
                      selectable={isMyTurn}
                      onClick={isMyTurn ? () => handleFaceDownCardClick(index) : undefined}
                    />
                  )}
                  {isPlayed && (
                    <div className="w-16 h-24 border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center text-gray-600">
                      Played
                    </div>
                  )}
                  <span className="text-sm text-gray-400">Slot {index}</span>
                </div>
              ))}
            </div>
            {isMyTurn && (
              <p className="text-sm text-gray-400 text-center mt-4">
                Select a face-down card to play (blind)
              </p>
            )}
          </div>
        )}

        {/* Action Buttons - only show if not playing facedown cards */}
        {isMyTurn && !isPlayingFaceDown && (
          <div className="flex justify-center gap-4">
            <Button
              onClick={handleSubmitPlay}
              variant="primary"
              size="large"
              disabled={selectedCards.length === 0 || (gameState.playableCards && gameState.playableCards.length === 0)}
            >
              Play Selected Cards
            </Button>
            {(gameState.playableCards && gameState.playableCards.length === 0) && (
              <Button
              onClick={handlePickUpPile}
              variant="danger"
            >
              Pick Up Pile (No valid plays)
            </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
