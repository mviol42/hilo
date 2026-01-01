import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import type { Card as CardType } from '@hilo/shared'
import { apiClient } from '@/services/api'
import { usePlayer, useGame, useUI } from '@/context'
import { Card, Hand, StackedCards, PlayAnimation, Button, TurnIndicator } from '@/components'

export function GamePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const gameId = searchParams.get('id')

  const { playerId } = usePlayer()
  const { gameState, selectedCards, showFaceUp, lastEvent, lastPlayedCards, pileBlownInfo, pilePickupInfo, dispatch: gameDispatch } = useGame()
  const { showToast, setIsLoading } = useUI()

  const [setupSelectedCards, setSetupSelectedCards] = useState<CardType[]>([])
  const [slideAnimation, setSlideAnimation] = useState<'top' | 'bottom' | null>(null)
  const [expandedOpponents, setExpandedOpponents] = useState<Set<string>>(new Set())
  const [revealedCard, setRevealedCard] = useState<{
    card: CardType
    outcome: 'pile' | 'pickup'
  } | null>(null)

  // Winning card phrase - randomly selected once on mount
  const [winningCardPhrase] = useState(() => {
    const phrases = [
      'The final blow:',
      'The winning card:',
      'Victory was sealed by:',
      'The card that ended it all:',
      'The knockout punch:',
      'This card sealed the deal:',
      'The finishing move:',
      'The card that made history:',
      'The game-ender:',
      'The coup de grâce:',
      'This card clinched the win:',
      'The death blow:',
      'The card that brought the house down:',
      'The nail in the coffin:',
      'The winning strike:',
      'This card closed the show:',
    ]
    return phrases[Math.floor(Math.random() * phrases.length)]
  })

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

  // Handle game events - clear events after processing
  useEffect(() => {
    if (lastEvent.type === 'pile_blown') {
      setTimeout(() => gameDispatch({ type: 'CLEAR_LAST_EVENT' }), 2000)
    }
  }, [lastEvent, gameDispatch])

  // Auto-dismiss standalone pile blown animation
  useEffect(() => {
    if (pileBlownInfo && !lastPlayedCards) {
      const timer = setTimeout(() => gameDispatch({ type: 'CLEAR_PILE_BLOWN' }), 1000)
      return () => clearTimeout(timer)
    }
  }, [pileBlownInfo, lastPlayedCards, gameDispatch])

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
    } catch (error: any) {
      console.error('Failed to play cards:', error)
      const message = error.response?.data?.message || 'Failed to play cards'
      showToast(message, 'error')
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

  const toggleOpponentExpand = (opponentId: string) => {
    setExpandedOpponents(prev => {
      const newSet = new Set(prev)
      if (newSet.has(opponentId)) {
        newSet.delete(opponentId)
      } else {
        newSet.add(opponentId)
      }
      return newSet
    })
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

        // Use server-provided pickedUpPile flag to determine outcome
        setRevealedCard({
          card: revealedCardData,
          outcome: response.pickedUpPile ? 'pickup' : 'pile'
        })

        // Wait for reveal animation (0.4s) + display time (0.25s)
        await new Promise(resolve => setTimeout(resolve, 650))
        setRevealedCard(null)
      }

      // Update game state after animation
      gameDispatch({ type: 'SET_GAME_STATE', payload: response.gameState })
      // Prevent double animation - revealedCard already showed the play outcome
      gameDispatch({ type: 'CLEAR_LAST_PLAYED' })
      gameDispatch({ type: 'CLEAR_PILE_BLOWN' })
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

  // Handle Play Again
  const handlePlayAgain = async () => {
    if (!gameId) return

    try {
      setIsLoading(true)
      const response = await apiClient.playAgain({ gameId })
      // Navigate to join page with the new lobby ID
      navigate(`/join?id=${response.lobbyId}`)
    } catch (error: any) {
      console.error('Failed to create play again lobby:', error)
      showToast(error.response?.data?.message || 'Failed to create new game', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // GAME ENDED
  if (isGameEnded) {
    const winningCard = gameState.lastAction?.cards?.[0]

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-5xl font-bold mb-4">
            {gameState.winner === playerId ? '🎉 You Won!' : 'Game Over'}
          </h1>
          {gameState.winner && gameState.winner !== playerId && (
            <p className="text-2xl text-gray-300 mb-4">
              {gameState.winnerName || `Player ${gameState.winner.substring(0, 8)}`} won!
            </p>
          )}
          {winningCard && (
            <div className="my-8">
              <p className="text-gray-400 mb-4">{winningCardPhrase}</p>
              <div className="flex justify-center" style={{ perspective: '1000px' }}>
                <div className="animate-card-spin-slow" style={{ transformStyle: 'preserve-3d' }}>
                  <Card card={winningCard} size="large" />
                </div>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-3">
            <Button onClick={handlePlayAgain} variant="success" size="large">
              Play Again
            </Button>
            <Button onClick={() => navigate('/')} variant="primary" size="large">
              Back to Menu
            </Button>
          </div>
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
  const playableCards = isMyTurn ? gameState.playableCards || [] : []
  const isPlayingFaceDown = gameState.myHand.length === 0 && gameState.myFaceUp.length === 0
  const isPlayingFaceUp = gameState.myHand.length === 0 && gameState.myFaceUp.length > 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-4">
      {/* Revealed Card Animation (for face-down plays with outcome) */}
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

      {/* Play Animation for pile pickup */}
      {pilePickupInfo && (() => {

        const resultMessagePlayer = pilePickupInfo.playerId === playerId ? 'You' : `${pilePickupInfo.playerName}`
        const resultMessage = `${resultMessagePlayer} picked up ${pilePickupInfo.cardCount} cards`

        // Determine whose turn is next
        const nextTurnMessage = gameState.activePlayerId === playerId
          ? 'Your turn!'
          : `${gameState.playerNames[gameState.activePlayerId] || 'Opponent'}'s turn`
        
        return (
          <PlayAnimation
            cards={[]}
            playerName={pilePickupInfo.playerName}
            resultMessage={resultMessage}
            resultType={'info'}
            nextTurnMessage={nextTurnMessage}
            isPickup={true}
            onComplete={() => {
              gameDispatch({ type: 'CLEAR_PILE_PICKUP' })
            }}
          />
        )
      })()}

      {/* Play Animation (for regular plays - don't show if face-down reveal is showing) */}
      {!revealedCard && lastPlayedCards && lastPlayedCards.cards.length > 0 && (() => {
        // Determine result message and type
        let resultMessage: string | undefined
        let resultType: 'success' | 'warning' | 'info' = 'info'

        if (pileBlownInfo) {
          resultMessage = pileBlownInfo.playerId === playerId ? 'Go again!' : 'Pile blown up!'
          resultType = 'success'
        }

        // Determine whose turn is next
        let nextTurnMessage: string | undefined
        if (!pileBlownInfo) {
          // Only show next turn if pile wasn't blown (blower goes again)
          const nextPlayerName = gameState.activePlayerId === playerId
            ? 'Your turn!'
            : `${gameState.playerNames[gameState.activePlayerId] || 'Opponent'}'s turn`
          nextTurnMessage = nextPlayerName
        }

        return (
          <PlayAnimation
            cards={lastPlayedCards.cards}
            playerName={lastPlayedCards.playerName}
            resultMessage={resultMessage}
            resultType={resultType}
            nextTurnMessage={nextTurnMessage}
            isPickup={false}
            onComplete={() => {
              gameDispatch({ type: 'CLEAR_LAST_PLAYED' })
              if (pileBlownInfo) {
                gameDispatch({ type: 'CLEAR_PILE_BLOWN' })
              }
            }}
          />
        )
      })()}

      {/* Standalone Pile Blown Animation (when we don't have the cards that caused it) */}
      {!revealedCard && !lastPlayedCards && pileBlownInfo && (
        <div className="fixed inset-0 flex flex-col items-center justify-center pointer-events-none z-50 bg-black/50">
          <div className="text-4xl font-bold text-green-400 animate-card-reveal">
            {pileBlownInfo.playerId === playerId ? 'Go again!' : 'Pile blown up!'}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="text-center">
          {gameState.turnOrder && (
            <TurnIndicator
              activePlayerId={gameState.activePlayerId}
              turnOrder={gameState.turnOrder}
              playerNames={gameState.playerNames}
              currentPlayerId={playerId!}
            />
          )}
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
            <div key={pid} className="mb-3">
              <div
                className="flex justify-between items-center cursor-pointer hover:bg-gray-700/50 rounded p-2 -mx-2"
                onClick={() => toggleOpponentExpand(pid)}
              >
                <span className="text-gray-300 flex items-center gap-2">
                  {player.name}
                  <span className={`text-xs transition-transform ${expandedOpponents.has(pid) ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </span>
                <div className="flex gap-2">
                  <span className="text-sm text-gray-400">{player.handCount} cards in hand</span>
                </div>
              </div>

              {expandedOpponents.has(pid) && (
                <div className="mt-2 animate-slide-in-from-top">
                  <StackedCards
                    faceUpCards={player.faceUp}
                    faceDownCount={player.faceDownCount}
                    size="small"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Toggle Button - only show if player has hand cards */}
        {(gameState.myHand.length > 0 && gameState.myFaceUp.length > 0) && (
          <div className="flex justify-center">
            <Button onClick={handleToggleFaceUp} variant="secondary">
              {showFaceUp ? 'Show Hand' : 'Show Face Up Cards'}
            </Button>
          </div>
        )}

        {/* Player's Hand - shown when toggle is off and has hand cards */}
        {gameState.myHand.length > 0 && !showFaceUp && (
          <Hand
            cards={gameState.myHand}
            selectedCards={selectedCards}
            playableCards={playableCards}
            onCardClick={isMyTurn ? handlePlayCardClick : undefined}
            title={`Your Hand - ${gameState.myHand.length} Card${gameState.myHand.length !== 1 ? 's' : ''}`}
            size="medium"
            className={`bg-gray-800/50 rounded-lg p-4 ${
              slideAnimation === 'bottom' ? 'animate-slide-in-from-bottom' : ''
            }`}
          />
        )}

        {/* Player's Face-Up + Face-Down Stacked - shown when toggled or no hand cards */}
        {((gameState.myHand.length > 0 && showFaceUp) || isPlayingFaceUp) && (
          <div className={`bg-gray-800/50 rounded-lg p-4 ${
            slideAnimation === 'top' ? 'animate-slide-in-from-top' : ''
          }`}>
            <h3 className="text-lg font-semibold mb-2 text-white">
              {isPlayingFaceUp
                ? `Your Face-Up Cards - ${gameState.myFaceUp.length} Card${gameState.myFaceUp.length !== 1 ? 's' : ''} (play from these)`
                : `Your Face-Up Cards - ${gameState.myFaceUp.length} Card${gameState.myFaceUp.length !== 1 ? 's' : ''}`}
            </h3>
            {isPlayingFaceUp ? (
              // When playing from face-up, make them selectable
              <Hand
                cards={gameState.myFaceUp}
                selectedCards={selectedCards}
                playableCards={playableCards}
                onCardClick={isMyTurn ? handlePlayCardClick : undefined}
                size="medium"
              />
            ) : (
              // When just viewing, show stacked visualization
              <StackedCards
                faceUpCards={gameState.myFaceUp}
                faceDownCount={gameState.myFaceDownCount}
                faceDownPlayed={gameState.myFaceDownPlayed}
              />
            )}
          </div>
        )}

        {/* Face-Down Cards - shown when playing from face-down (no hand, no face-up) */}
        {isPlayingFaceDown && gameState.myFaceDownCount > 0 && (
          <StackedCards
            faceUpCards={[]}
            faceDownCount={gameState.myFaceDownCount}
            faceDownPlayed={gameState.myFaceDownPlayed}
            onFaceDownClick={handleFaceDownCardClick}
            isMyTurn={isMyTurn}
            isPlayingFromFaceDown={true}
          />
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
