import { describe, it, expect } from 'vitest';
import {
  initializeGame,
  dealCards,
  selectFaceUpCards,
  startGame,
  determineFirstPlayer,
  getLowestNonSpecialRank,
  GameEngineError,
} from '../../../../src/services/gameEngine';
import { GameState, PlayerGameState } from '@hilo/shared';

describe('Game Initialization', () => {
  const testRoomId = 'test-room-1';

  describe('initializeGame', () => {
    it('should create game with correct number of players', () => {
      const playerIds = ['player1', 'player2', 'player3'];
      const game = initializeGame(playerIds, testRoomId);

      expect(game.players.size).toBe(3);
      expect(game.turnOrder).toEqual(playerIds);
    });

    it('should initialize with setup phase', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);

      expect(game.phase).toBe('setup');
    });

    it('should create shuffled deck', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);

      expect(game.deck.length).toBeGreaterThan(0);
    });

    it('should initialize empty pile and discard pile', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);

      expect(game.pile).toEqual([]);
      expect(game.discardPile).toEqual([]);
    });

    it('should set first player as active', () => {
      const game = initializeGame(['p1', 'p2', 'p3'], testRoomId);

      expect(game.activePlayerId).toBe('p1');
    });

    it('should initialize each player with empty cards', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);

      for (const [playerId, state] of game.players) {
        expect(state.hand).toEqual([]);
        expect(state.faceUp).toEqual([]);
        expect(state.faceDown).toEqual([]);
      }
    });

    it('should generate game ID with room ID prefix', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);

      expect(game.id).toMatch(new RegExp(`^${testRoomId}:game:[a-f0-9-]+$`));
    });

    it('should throw error for less than 2 players', () => {
      expect(() => initializeGame(['p1'], testRoomId)).toThrow('Game requires at least 2 players');
      expect(() => initializeGame([], testRoomId)).toThrow('Game requires at least 2 players');
    });
  });

  describe('dealCards', () => {
    it('should deal 9 cards to each player', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      const dealtGame = dealCards(game);

      for (const [playerId, state] of dealtGame.players) {
        const totalCards = state.hand.length + state.faceDown.length;
        expect(totalCards).toBe(9);
      }
    });

    it('should deal 3 face-down cards to each player', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      const dealtGame = dealCards(game);

      for (const [playerId, state] of dealtGame.players) {
        expect(state.faceDown).toHaveLength(3);
      }
    });

    it('should deal 6 cards to hand', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      const dealtGame = dealCards(game);

      for (const [playerId, state] of dealtGame.players) {
        expect(state.hand).toHaveLength(6);
      }
    });

    it('should reduce deck size after dealing', () => {
      // Using 2 players instead of 3 to work with halved deck size
      const game = initializeGame(['p1', 'p2'], testRoomId);
      const initialDeckSize = game.deck.length;
      const dealtGame = dealCards(game);

      expect(dealtGame.deck.length).toBe(initialDeckSize - (9 * 2));
    });

    it('should not give duplicate cards to players', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      const dealtGame = dealCards(game);

      const allDealtCards = [];
      for (const state of dealtGame.players.values()) {
        allDealtCards.push(...state.hand, ...state.faceDown);
      }

      const uniqueCards = new Set(allDealtCards.map(c => `${c.rank}-${c.suit}`));
      expect(uniqueCards.size).toBe(allDealtCards.length);
    });
  });

  describe('selectFaceUpCards', () => {
    it('should move 3 cards from hand to face-up', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      const dealtGame = dealCards(game);
      const selected = selectFaceUpCards(dealtGame, 'p1', [0, 1, 2]);

      const p1State = selected.players.get('p1')!;
      expect(p1State.faceUp).toHaveLength(3);
      expect(p1State.hand).toHaveLength(3);
    });

    it('should throw error if not exactly 3 cards selected', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      const dealtGame = dealCards(game);

      expect(() => selectFaceUpCards(dealtGame, 'p1', [0, 1])).toThrow('Must select exactly 3 face-up cards');
      expect(() => selectFaceUpCards(dealtGame, 'p1', [0, 1, 2, 3])).toThrow('Must select exactly 3 face-up cards');
    });

    it('should throw error for duplicate indices', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      const dealtGame = dealCards(game);

      expect(() => selectFaceUpCards(dealtGame, 'p1', [0, 0, 1])).toThrow('Card indices must be unique');
    });

    it('should throw error for out of range indices', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      const dealtGame = dealCards(game);

      expect(() => selectFaceUpCards(dealtGame, 'p1', [0, 1, 6])).toThrow('Card index out of range');
      expect(() => selectFaceUpCards(dealtGame, 'p1', [-1, 0, 1])).toThrow('Card index out of range');
    });

    it('should throw error if player not found', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      const dealtGame = dealCards(game);

      expect(() => selectFaceUpCards(dealtGame, 'p999', [0, 1, 2])).toThrow('Player not found');
    });

    it('should throw error if player does not have 6 cards in hand', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);

      expect(() => selectFaceUpCards(game, 'p1', [0, 1, 2])).toThrow('Player must have 6 cards in hand');
    });
  });

  describe('getLowestNonSpecialRank', () => {
    it('should return lowest non-special rank from hand and face-up', () => {
      const playerState: PlayerGameState = {
        hand: [
          { rank: '7', suit: 'hearts' },
          { rank: '9', suit: 'diamonds' },
        ],
        faceUp: [
          { rank: '5', suit: 'clubs' },
          { rank: 'K', suit: 'spades' },
        ],
        faceDown: [],
      };

      const result = getLowestNonSpecialRank(playerState);
      expect(result).toEqual({ rank: '5', count: 1 });
    });

    it('should ignore special cards (2, 8, 10)', () => {
      const playerState: PlayerGameState = {
        hand: [
          { rank: '2', suit: 'hearts' },
          { rank: '8', suit: 'diamonds' },
          { rank: '10', suit: 'clubs' },
          { rank: '9', suit: 'spades' },
        ],
        faceUp: [],
        faceDown: [],
      };

      const result = getLowestNonSpecialRank(playerState);
      expect(result).toEqual({ rank: '9', count: 1 });
    });

    it('should count multiple cards of same rank', () => {
      const playerState: PlayerGameState = {
        hand: [
          { rank: '5', suit: 'hearts' },
          { rank: '5', suit: 'diamonds' },
        ],
        faceUp: [
          { rank: '5', suit: 'clubs' },
        ],
        faceDown: [],
      };

      const result = getLowestNonSpecialRank(playerState);
      expect(result).toEqual({ rank: '5', count: 3 });
    });

    it('should return null if only special cards', () => {
      const playerState: PlayerGameState = {
        hand: [
          { rank: '2', suit: 'hearts' },
          { rank: '10', suit: 'diamonds' },
        ],
        faceUp: [
          { rank: '8', suit: 'clubs' },
        ],
        faceDown: [],
      };

      const result = getLowestNonSpecialRank(playerState);
      expect(result).toBeNull();
    });

    it('should return null if no cards', () => {
      const playerState: PlayerGameState = {
        hand: [],
        faceUp: [],
        faceDown: [],
      };

      const result = getLowestNonSpecialRank(playerState);
      expect(result).toBeNull();
    });
  });

  describe('determineFirstPlayer', () => {
    it('should select player with lowest non-special rank', () => {
      const game = initializeGame(['p1', 'p2', 'p3'], testRoomId);

      game.players.set('p1', {
        hand: [{ rank: '7', suit: 'hearts' }],
        faceUp: [{ rank: '9', suit: 'diamonds' }],
        faceDown: [],
      });
      game.players.set('p2', {
        hand: [{ rank: '5', suit: 'clubs' }],
        faceUp: [{ rank: 'K', suit: 'spades' }],
        faceDown: [],
      });
      game.players.set('p3', {
        hand: [{ rank: 'A', suit: 'hearts' }],
        faceUp: [],
        faceDown: [],
      });

      const firstPlayer = determineFirstPlayer(game);
      expect(firstPlayer).toBe('p2');
    });

    it('should randomly select from tied players', () => {
      const game = initializeGame(['p1', 'p2', 'p3'], testRoomId);

      game.players.set('p1', {
        hand: [{ rank: '5', suit: 'hearts' }],
        faceUp: [],
        faceDown: [],
      });
      game.players.set('p2', {
        hand: [{ rank: '5', suit: 'clubs' }],
        faceUp: [],
        faceDown: [],
      });
      game.players.set('p3', {
        hand: [{ rank: 'K', suit: 'spades' }],
        faceUp: [],
        faceDown: [],
      });

      const results = new Set<string>();
      for (let i = 0; i < 20; i++) {
        results.add(determineFirstPlayer(game));
      }

      expect(results.has('p1') || results.has('p2')).toBe(true);
      expect(results.has('p3')).toBe(false);
    });

    it('should return first player if all have only special cards', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);

      game.players.set('p1', {
        hand: [{ rank: '2', suit: 'hearts' }],
        faceUp: [],
        faceDown: [],
      });
      game.players.set('p2', {
        hand: [{ rank: '10', suit: 'clubs' }],
        faceUp: [],
        faceDown: [],
      });

      const firstPlayer = determineFirstPlayer(game);
      expect(firstPlayer).toBe('p1');
    });
  });

  describe('startGame', () => {
    it('should transition from setup to playing phase', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      const dealtGame = dealCards(game);
      const p1Selected = selectFaceUpCards(dealtGame, 'p1', [0, 1, 2]);
      const p2Selected = selectFaceUpCards(p1Selected, 'p2', [0, 1, 2]);
      const startedGame = startGame(p2Selected);

      expect(startedGame.phase).toBe('playing');
    });

    it('should set active player to first player', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      const dealtGame = dealCards(game);

      game.players.set('p1', {
        hand: [{ rank: '5', suit: 'hearts' }],
        faceUp: [{ rank: '6', suit: 'clubs' }, { rank: '7', suit: 'diamonds' }, { rank: '9', suit: 'spades' }],
        faceDown: [],
      });
      game.players.set('p2', {
        hand: [{ rank: 'K', suit: 'hearts' }],
        faceUp: [{ rank: 'Q', suit: 'clubs' }, { rank: 'J', suit: 'diamonds' }, { rank: 'A', suit: 'spades' }],
        faceDown: [],
      });

      const startedGame = startGame(game);
      expect(startedGame.activePlayerId).toBe('p1');
    });

    it('should throw error if game already started', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      const dealtGame = dealCards(game);
      const p1Selected = selectFaceUpCards(dealtGame, 'p1', [0, 1, 2]);
      const p2Selected = selectFaceUpCards(p1Selected, 'p2', [0, 1, 2]);
      const startedGame = startGame(p2Selected);

      expect(() => startGame(startedGame)).toThrow('Game already started');
    });

    it('should throw error if players have not selected face-up cards', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      const dealtGame = dealCards(game);

      expect(() => startGame(dealtGame)).toThrow('has not selected face-up cards');
    });
  });
});
