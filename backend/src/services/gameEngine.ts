import { Card, Rank, Suit, RANK_ORDER, SPECIAL_RANKS } from '@hilo/shared';
import { GameState, GamePhase } from '@hilo/shared';
import { PlayerId, PlayerGameState } from '@hilo/shared';
import { v4 as uuidv4 } from 'uuid';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export class GameEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameEngineError';
  }
}

export function createDeck(numPlayers: number): Card[] {
  const numDecks = Math.ceil(numPlayers / 4);
  const cards: Card[] = [];

  for (let d = 0; d < numDecks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ rank, suit });
      }
    }
  }


  // For testing purposes, return half the cards.
  return cards.slice(0, cards.length / 2);
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function getRankValue(rank: Rank): number {
  const index = RANK_ORDER.indexOf(rank);
  if (index === -1) {
    throw new GameEngineError(`Invalid rank for comparison: ${rank}`);
  }
  return index;
}

export function isSpecialRank(rank: Rank): boolean {
  return rank === SPECIAL_RANKS.RESET ||
         rank === SPECIAL_RANKS.INVISIBLE ||
         rank === SPECIAL_RANKS.BLOW_UP;
}

export function getTopNonInvisibleCard(pile: Card[]): Card | null {
  for (let i = pile.length - 1; i >= 0; i--) {
    if (pile[i].rank !== SPECIAL_RANKS.INVISIBLE) {
      return pile[i];
    }
  }
  return null;
}

export function isCardPlayable(card: Card, pile: Card[]): boolean {
  const rank = card.rank;

  if (rank === SPECIAL_RANKS.RESET ||
      rank === SPECIAL_RANKS.INVISIBLE ||
      rank === SPECIAL_RANKS.BLOW_UP) {
    return true;
  }

  if (pile.length === 0) {
    return true;
  }

  const topCard = getTopNonInvisibleCard(pile);
  if (!topCard) {
    return true;
  }

  const topRank = topCard.rank;

  if (topRank === '7') {
    return getRankValue(rank) <= getRankValue('7');
  }

  return getRankValue(rank) >= getRankValue(topRank);
}

export function getPlayableCards(cards: Card[], pile: Card[]): Card[] {
  return cards.filter(card => isCardPlayable(card, pile));
}

export function getPlayableRanks(cards: Card[], pile: Card[]): Rank[] {
  const playableCards = getPlayableCards(cards, pile);
  const ranks = new Set(playableCards.map(c => c.rank));
  return Array.from(ranks);
}

export function initializeGame(playerIds: PlayerId[], roomId: string): GameState {
  if (playerIds.length < 2) {
    throw new GameEngineError('Game requires at least 2 players');
  }

  const deck = shuffleDeck(createDeck(playerIds.length));
  const players = new Map<PlayerId, PlayerGameState>();

  for (const playerId of playerIds) {
    players.set(playerId, {
      hand: [],
      faceUp: [],
      faceDown: [],
    });
  }

  // Generate game ID with room ID prefix: <roomId>:game:<uuid>
  const gameId = `${roomId}:game:${uuidv4()}`;

  return {
    id: gameId,
    phase: 'setup',
    players,
    deck,
    pile: [],
    discardPile: [],
    activePlayerId: playerIds[0],
    turnOrder: [...playerIds],
    log: [],
    winner: undefined,
  };
}

export function dealCards(gameState: GameState): GameState {
  const newState = { ...gameState };

  for (const playerId of newState.turnOrder) {
    const playerState = newState.players.get(playerId);
    if (!playerState) continue;

    const dealtCards: Card[] = [];
    for (let i = 0; i < 9 && newState.deck.length > 0; i++) {
      const card = newState.deck.pop()!;
      dealtCards.push(card);
    }

    playerState.faceDown = dealtCards.slice(0, 3);
    playerState.hand = dealtCards.slice(3);
  }

  return newState;
}

export function selectFaceUpCards(
  gameState: GameState,
  playerId: PlayerId,
  cardIndices: number[]
): GameState {
  if (cardIndices.length !== 3) {
    throw new GameEngineError('Must select exactly 3 face-up cards');
  }

  const playerState = gameState.players.get(playerId);
  if (!playerState) {
    throw new GameEngineError('Player not found');
  }

  if (playerState.hand.length !== 6) {
    throw new GameEngineError('Player must have 6 cards in hand to select face-up cards');
  }

  const uniqueIndices = new Set(cardIndices);
  if (uniqueIndices.size !== 3) {
    throw new GameEngineError('Card indices must be unique');
  }

  for (const idx of cardIndices) {
    if (idx < 0 || idx >= 6) {
      throw new GameEngineError('Card index out of range');
    }
  }

  const newState = { ...gameState };
  const newPlayerState = { ...playerState };

  const sortedIndices = [...cardIndices].sort((a, b) => b - a);

  for (const idx of sortedIndices) {
    const card = newPlayerState.hand.splice(idx, 1)[0];
    newPlayerState.faceUp.push(card);
  }

  newState.activePlayerId = getNextPlayerId(gameState, gameState.activePlayerId)
  newState.players.set(playerId, newPlayerState);

  return newState;
}

export function getLowestNonSpecialRank(playerState: PlayerGameState): { rank: Rank; count: number } | null {
  const allCards = [...playerState.hand, ...playerState.faceUp];
  const nonSpecialCards = allCards.filter(card => !isSpecialRank(card.rank));

  if (nonSpecialCards.length === 0) {
    return null;
  }

  let lowestRank = nonSpecialCards[0].rank;
  let lowestValue = getRankValue(lowestRank);

  for (const card of nonSpecialCards) {
    const value = getRankValue(card.rank);
    if (value < lowestValue) {
      lowestValue = value;
      lowestRank = card.rank;
    }
  }

  const count = nonSpecialCards.filter(c => c.rank === lowestRank).length;

  return { rank: lowestRank, count };
}

export function determineFirstPlayer(gameState: GameState): PlayerId {
  let lowestValue = Infinity;
  const candidates: PlayerId[] = [];

  for (const [playerId, playerState] of gameState.players) {
    const lowest = getLowestNonSpecialRank(playerState);
    if (!lowest) continue;

    const value = getRankValue(lowest.rank);

    if (value < lowestValue) {
      lowestValue = value;
      candidates.length = 0;
      candidates.push(playerId);
    } else if (value === lowestValue) {
      candidates.push(playerId);
    }
  }

  if (candidates.length === 0) {
    return gameState.turnOrder[0];
  }

  const randomIndex = Math.floor(Math.random() * candidates.length);
  return candidates[randomIndex];
}

export function checkBlowUp(pile: Card[]): boolean {
  if (pile.length === 0) {
    return false;
  }

  const topCard = pile[pile.length - 1];
  if (topCard.rank === SPECIAL_RANKS.BLOW_UP) {
    return true;
  }

  if (pile.length >= 4) {
    const last4 = pile.slice(-4);
    const firstRank = last4[0].rank;
    const allSameRank = last4.every(card => card.rank === firstRank);
    if (allSameRank) {
      return true;
    }
  }

  return false;
}

export function hasNoCards(playerState: PlayerGameState): boolean {
  return playerState.hand.length === 0 &&
         playerState.faceUp.length === 0 &&
         playerState.faceDown.every(card => card === null);
}

export function drawCardsToHand(gameState: GameState, playerId: PlayerId): GameState {
  const newState = { ...gameState };
  const playerState = newState.players.get(playerId);

  if (!playerState) {
    throw new GameEngineError('Player not found');
  }

  const newPlayerState = { ...playerState };

  while (newPlayerState.hand.length < 3 && newState.deck.length > 0) {
    const card = newState.deck.pop()!;
    newPlayerState.hand.push(card);
  }

  newState.players.set(playerId, newPlayerState);

  return newState;
}

export function getNextPlayerId(gameState: GameState, currentPlayerId: PlayerId): PlayerId {
  const currentIndex = gameState.turnOrder.indexOf(currentPlayerId);
  const nextIndex = (currentIndex + 1) % gameState.turnOrder.length;
  return gameState.turnOrder[nextIndex];
}

export function playCards(
  gameState: GameState,
  playerId: PlayerId,
  cards: Card[],
  source: 'hand' | 'faceUp' | 'faceDown',
  faceDownIndex?: number
): GameState {
  if (playerId !== gameState.activePlayerId) {
    throw new GameEngineError('Not player turn');
  }

  if (cards.length === 0) {
    throw new GameEngineError('Must play at least one card');
  }

  const playerState = gameState.players.get(playerId);
  if (!playerState) {
    throw new GameEngineError('Player not found');
  }

  const firstRank = cards[0].rank;
  const allSameRank = cards.every(card => card.rank === firstRank);
  if (!allSameRank) {
    throw new GameEngineError('All cards must be the same rank');
  }

  let newState = { ...gameState };
  const newPlayerState = { ...playerState };

  if (source === 'hand') {
    if (newPlayerState.hand.length === 0) {
      throw new GameEngineError('No cards in hand');
    }

    const playableRanks = getPlayableRanks(newPlayerState.hand, newState.pile);
    if (playableRanks.length === 0) {
      throw new GameEngineError('No Playable Card');
    }

    if (!playableRanks.includes(firstRank)) {
      throw new GameEngineError('Card not playable');
    }

    for (const card of cards) {
      const cardIndex = newPlayerState.hand.findIndex(
        c => c.rank === card.rank && c.suit === card.suit
      );
      if (cardIndex === -1) {
        throw new GameEngineError('Card not in hand');
      }
      newPlayerState.hand.splice(cardIndex, 1);
    }

    newState.pile.push(...cards);
    newState.players.set(playerId, newPlayerState);

    const handEmptyAfterPlay = newPlayerState.hand.length === 0;

    if (handEmptyAfterPlay && newPlayerState.faceUp.length > 0) {
      const bonusCards = newPlayerState.faceUp.filter(c => c.rank === firstRank);
      if (bonusCards.length > 0) {
        for (const card of bonusCards) {
          const idx = newPlayerState.faceUp.findIndex(
            c => c.rank === card.rank && c.suit === card.suit
          );
          if (idx !== -1) {
            newPlayerState.faceUp.splice(idx, 1);
            newState.pile.push(card);
          }
        }
        newState.players.set(playerId, newPlayerState);
      }
    }
  } else if (source === 'faceUp') {
    if (newPlayerState.hand.length > 0) {
      throw new GameEngineError('Must play from hand first');
    }

    if (newPlayerState.faceUp.length === 0) {
      throw new GameEngineError('No face-up cards');
    }

    const playableRanks = getPlayableRanks(newPlayerState.faceUp, newState.pile);
    if (playableRanks.length === 0) {
      throw new GameEngineError('No Playable Card');
    }

    if (!playableRanks.includes(firstRank)) {
      throw new GameEngineError('Card not playable');
    }

    for (const card of cards) {
      const cardIndex = newPlayerState.faceUp.findIndex(
        c => c.rank === card.rank && c.suit === card.suit
      );
      if (cardIndex === -1) {
        throw new GameEngineError('Card not in face-up cards');
      }
      newPlayerState.faceUp.splice(cardIndex, 1);
    }

    newState.pile.push(...cards);
    newState.players.set(playerId, newPlayerState);
  } else if (source === 'faceDown') {
    if (newPlayerState.hand.length > 0 || newPlayerState.faceUp.length > 0) {
      throw new GameEngineError('Must play hand and face-up cards first');
    }

    if (newPlayerState.faceDown.every(card => card === null)) {
      throw new GameEngineError('No face-down cards');
    }

    if (faceDownIndex === undefined) {
      throw new GameEngineError('Must specify face-down card index');
    }

    if (faceDownIndex < 0 || faceDownIndex >= newPlayerState.faceDown.length) {
      throw new GameEngineError('Face-down card index out of range');
    }

    const card = newPlayerState.faceDown[faceDownIndex];

    if (card === null) {
      throw new GameEngineError('Face-down card already played');
    }

    if (cards.length !== 1) {
      throw new GameEngineError('Can only play one face-down card at a time');
    }

    if (isCardPlayable(card, newState.pile)) {
      newPlayerState.faceDown[faceDownIndex] = null;
      newState.pile.push(card);
      newState.players.set(playerId, newPlayerState);
    } else {
      newPlayerState.faceDown[faceDownIndex] = null;
      newPlayerState.hand.push(card);
      newPlayerState.hand.push(...newState.pile);
      newState.pile = [];
      newState.players.set(playerId, newPlayerState);

      newState = drawCardsToHand(newState, playerId);
      newState.activePlayerId = getNextPlayerId(newState, playerId);

      return newState;
    }
  }

  const blowUp = checkBlowUp(newState.pile);

  if (blowUp) {
    newState.discardPile.push(...newState.pile);
    newState.pile = [];
  }

  newState = drawCardsToHand(newState, playerId);

  const finalPlayerState = newState.players.get(playerId)!;
  if (hasNoCards(finalPlayerState)) {
    newState.winner = playerId;
    newState.phase = 'ended';
    return newState;
  }

  if (blowUp) {
    newState.activePlayerId = playerId;
  } else {
    newState.activePlayerId = getNextPlayerId(newState, playerId);
  }

  return newState;
}

export function pickupPile(gameState: GameState, playerId: PlayerId): GameState {
  if (playerId !== gameState.activePlayerId) {
    throw new GameEngineError('Not player turn');
  }

  const playerState = gameState.players.get(playerId);
  if (!playerState) {
    throw new GameEngineError('Player not found');
  }

  const newState = { ...gameState };
  const newPlayerState = {
    hand: [...playerState.hand],
    faceUp: [...playerState.faceUp],
    faceDown: [...playerState.faceDown],
  };

  if (newPlayerState.hand.length > 0) {
    const playableRanks = getPlayableRanks(newPlayerState.hand, newState.pile);
    if (playableRanks.length > 0) {
      throw new GameEngineError('Must play a card if possible');
    }
  } else if (newPlayerState.faceUp.length > 0) {
    const playableRanks = getPlayableRanks(newPlayerState.faceUp, newState.pile);
    if (playableRanks.length > 0) {
      throw new GameEngineError('Must play a card if possible');
    }
  } else {
    throw new GameEngineError('Cannot pick up pile when playing face-down cards');
  }

  newPlayerState.hand.push(...newState.pile);
  newState.pile = [];

  if (playerState.hand.length === 0 && playerState.faceUp.length > 0) {
    const firstFaceUpRank = newPlayerState.faceUp[0].rank;
    const sameFaceUpCards = newPlayerState.faceUp.filter(c => c.rank === firstFaceUpRank);

    for (const card of sameFaceUpCards) {
      const idx = newPlayerState.faceUp.findIndex(
        c => c.rank === card.rank && c.suit === card.suit
      );
      if (idx !== -1) {
        const removed = newPlayerState.faceUp.splice(idx, 1)[0];
        newPlayerState.hand.push(removed);
      }
    }
  }

  newState.players.set(playerId, newPlayerState);

  newState.activePlayerId = getNextPlayerId(newState, playerId);

  return newState;
}

export function startGame(gameState: GameState): GameState {
  if (gameState.phase !== 'setup') {
    throw new GameEngineError('Game already started');
  }

  for (const [playerId, playerState] of gameState.players) {
    if (playerState.faceUp.length !== 3) {
      throw new GameEngineError(`Player ${playerId} has not selected face-up cards`);
    }
  }

  const newState = { ...gameState, phase: 'playing' as GamePhase };

  const firstPlayer = determineFirstPlayer(newState);
  newState.activePlayerId = firstPlayer;

  return newState;
}
