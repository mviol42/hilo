import { describe, it, expect } from 'vitest';
import {
  initializeGame,
  playCards,
  GameEngineError,
} from '../../../../src/services/gameEngine';
import { Card, GameState } from '@hilo/shared';

describe('Play Cards', () => {
  const testRoomId = 'test-room-1';

  describe('playCards - Happy Path from Hand', () => {
    it('should play a single card from hand', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.deck = [];

      game.players.set('p1', {
        hand: [{ rank: '5', suit: 'hearts' }, { rank: '7', suit: 'diamonds' }],
        faceUp: [],
        faceDown: [],
      });

      const card: Card = { rank: '5', suit: 'hearts' };
      const newGame = playCards(game, 'p1', [card], 'hand');

      const p1State = newGame.players.get('p1')!;
      expect(p1State.hand).toHaveLength(1);
      expect(newGame.pile).toHaveLength(1);
      expect(newGame.pile[0]).toEqual(card);
    });

    it('should play multiple cards of same rank', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.deck = [];

      game.players.set('p1', {
        hand: [
          { rank: '5', suit: 'hearts' },
          { rank: '5', suit: 'diamonds' },
          { rank: '7', suit: 'clubs' },
        ],
        faceUp: [],
        faceDown: [],
      });

      const cards: Card[] = [
        { rank: '5', suit: 'hearts' },
        { rank: '5', suit: 'diamonds' },
      ];
      const newGame = playCards(game, 'p1', cards, 'hand');

      const p1State = newGame.players.get('p1')!;
      expect(p1State.hand).toHaveLength(1);
      expect(newGame.pile).toHaveLength(2);
    });

    it('should add cards to existing pile', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.pile = [{ rank: '3', suit: 'spades' }];

      game.players.set('p1', {
        hand: [{ rank: '5', suit: 'hearts' }],
        faceUp: [],
        faceDown: [],
      });

      const card: Card = { rank: '5', suit: 'hearts' };
      const newGame = playCards(game, 'p1', [card], 'hand');

      expect(newGame.pile).toHaveLength(2);
      expect(newGame.pile[1]).toEqual(card);
    });

    it('should move to next player after playing', () => {
      const game = initializeGame(['p1', 'p2', 'p3'], testRoomId);
      game.phase = 'playing';
      game.activePlayerId = 'p1';

      game.players.set('p1', {
        hand: [{ rank: '5', suit: 'hearts' }],
        faceUp: [],
        faceDown: [{ rank: '2', suit: 'clubs' }],
      });

      const newGame = playCards(game, 'p1', [{ rank: '5', suit: 'hearts' }], 'hand');

      expect(newGame.activePlayerId).toBe('p2');
    });

    it('should draw cards after playing to maintain 3 in hand', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.deck = [
        { rank: 'K', suit: 'spades' },
        { rank: 'Q', suit: 'spades' },
      ];

      game.players.set('p1', {
        hand: [{ rank: '5', suit: 'hearts' }],
        faceUp: [],
        faceDown: [],
      });

      const newGame = playCards(game, 'p1', [{ rank: '5', suit: 'hearts' }], 'hand');

      const p1State = newGame.players.get('p1')!;
      expect(p1State.hand).toHaveLength(2);
      expect(newGame.deck).toHaveLength(0);
    });

    it('should not draw if deck is empty', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.deck = [];

      game.players.set('p1', {
        hand: [{ rank: '5', suit: 'hearts' }],
        faceUp: [],
        faceDown: [],
      });

      const newGame = playCards(game, 'p1', [{ rank: '5', suit: 'hearts' }], 'hand');

      const p1State = newGame.players.get('p1')!;
      expect(p1State.hand).toHaveLength(0);
    });
  });

  describe('playCards - Bonus Play from Face-Up', () => {
    it('should allow bonus play of same rank from face-up when hand becomes empty', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.deck = [];

      game.players.set('p1', {
        hand: [{ rank: '5', suit: 'hearts' }],
        faceUp: [
          { rank: '5', suit: 'diamonds' },
          { rank: '7', suit: 'clubs' },
        ],
        faceDown: [],
      });

      const newGame = playCards(game, 'p1', [{ rank: '5', suit: 'hearts' }], 'hand');

      const p1State = newGame.players.get('p1')!;
      expect(p1State.hand).toHaveLength(0);
      expect(p1State.faceUp).toHaveLength(1);
      expect(p1State.faceUp[0].rank).toBe('7');
      expect(newGame.pile).toHaveLength(2);
      expect(newGame.pile[0].rank).toBe('5');
      expect(newGame.pile[1].rank).toBe('5');
    });

    it('should not bonus play if hand still has cards', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.deck = [];

      game.players.set('p1', {
        hand: [
          { rank: '5', suit: 'hearts' },
          { rank: '6', suit: 'spades' },
        ],
        faceUp: [{ rank: '5', suit: 'diamonds' }],
        faceDown: [],
      });

      const newGame = playCards(game, 'p1', [{ rank: '5', suit: 'hearts' }], 'hand');

      const p1State = newGame.players.get('p1')!;
      expect(p1State.hand).toHaveLength(1);
      expect(p1State.faceUp).toHaveLength(1);
      expect(newGame.pile).toHaveLength(1);
    });
  });

  describe('playCards - From Face-Up', () => {
    it('should play from face-up when hand is empty', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.deck = [];

      game.players.set('p1', {
        hand: [],
        faceUp: [{ rank: '5', suit: 'hearts' }, { rank: '7', suit: 'diamonds' }],
        faceDown: [],
      });

      const newGame = playCards(game, 'p1', [{ rank: '5', suit: 'hearts' }], 'faceUp');

      const p1State = newGame.players.get('p1')!;
      expect(p1State.faceUp).toHaveLength(1);
      expect(newGame.pile).toHaveLength(1);
    });

    it('should throw error if trying to play from face-up with cards in hand', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      game.phase = 'playing';
      game.activePlayerId = 'p1';

      game.players.set('p1', {
        hand: [{ rank: '6', suit: 'clubs' }],
        faceUp: [{ rank: '5', suit: 'hearts' }],
        faceDown: [],
      });

      expect(() => playCards(game, 'p1', [{ rank: '5', suit: 'hearts' }], 'faceUp'))
        .toThrow('Must play from hand first');
    });

    it('should throw error if no face-up cards available', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      game.phase = 'playing';
      game.activePlayerId = 'p1';

      game.players.set('p1', {
        hand: [],
        faceUp: [],
        faceDown: [{ rank: '5', suit: 'hearts' }],
      });

      expect(() => playCards(game, 'p1', [{ rank: '5', suit: 'hearts' }], 'faceUp'))
        .toThrow('No face-up cards');
    });
  });

  describe('playCards - From Face-Down', () => {
    it('should play face-down card if playable', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.deck = [];
      game.pile = [{ rank: '5', suit: 'clubs' }];

      game.players.set('p1', {
        hand: [],
        faceUp: [],
        faceDown: [{ rank: '7', suit: 'hearts' }],
      });

      const newGame = playCards(game, 'p1', [{ rank: '7', suit: 'hearts' }], 'faceDown', 0);

      const p1State = newGame.players.get('p1')!;
      expect(p1State.faceDown).toHaveLength(1);
      expect(p1State.faceDown[0]).toBe(null);
      expect(newGame.pile).toHaveLength(2);
      expect(newGame.pile[1].rank).toBe('7');
    });

    it('should pickup pile if face-down card not playable', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.deck = [];
      game.pile = [{ rank: '9', suit: 'clubs' }];

      game.players.set('p1', {
        hand: [],
        faceUp: [],
        faceDown: [{ rank: '5', suit: 'hearts' }],
      });
      game.players.set('p2', {
        hand: [],
        faceUp: [],
        faceDown: [],
      });

      const newGame = playCards(game, 'p1', [{ rank: '5', suit: 'hearts' }], 'faceDown', 0);

      const p1State = newGame.players.get('p1')!;
      expect(p1State.faceDown).toHaveLength(1);
      expect(p1State.faceDown[0]).toBe(null);
      expect(p1State.hand).toHaveLength(2);
      expect(newGame.pile).toHaveLength(0);
      expect(newGame.activePlayerId).toBe('p2');
    });

    it('should throw error if trying to play face-down with hand cards', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      game.phase = 'playing';
      game.activePlayerId = 'p1';

      game.players.set('p1', {
        hand: [{ rank: '6', suit: 'clubs' }],
        faceUp: [],
        faceDown: [{ rank: '5', suit: 'hearts' }],
      });

      expect(() => playCards(game, 'p1', [{ rank: '5', suit: 'hearts' }], 'faceDown', 0))
        .toThrow('Must play hand and face-up cards first');
    });

    it('should throw error if trying to play face-down with face-up cards', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      game.phase = 'playing';
      game.activePlayerId = 'p1';

      game.players.set('p1', {
        hand: [],
        faceUp: [{ rank: '6', suit: 'clubs' }],
        faceDown: [{ rank: '5', suit: 'hearts' }],
      });

      expect(() => playCards(game, 'p1', [{ rank: '5', suit: 'hearts' }], 'faceDown', 0))
        .toThrow('Must play hand and face-up cards first');
    });

    it('should throw error if face-down index out of range', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      game.phase = 'playing';
      game.activePlayerId = 'p1';

      game.players.set('p1', {
        hand: [],
        faceUp: [],
        faceDown: [{ rank: '5', suit: 'hearts' }],
      });

      expect(() => playCards(game, 'p1', [{ rank: '5', suit: 'hearts' }], 'faceDown', 5))
        .toThrow('Face-down card index out of range');
    });

    it('should throw error if no face-down index provided', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      game.phase = 'playing';
      game.activePlayerId = 'p1';

      game.players.set('p1', {
        hand: [],
        faceUp: [],
        faceDown: [{ rank: '5', suit: 'hearts' }],
      });

      expect(() => playCards(game, 'p1', [{ rank: '5', suit: 'hearts' }], 'faceDown'))
        .toThrow('Must specify face-down card index');
    });
  });

  describe('playCards - Error Cases', () => {
    it('should throw error if not player turn', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      game.phase = 'playing';
      game.activePlayerId = 'p1';

      game.players.set('p2', {
        hand: [{ rank: '5', suit: 'hearts' }],
        faceUp: [],
        faceDown: [],
      });

      expect(() => playCards(game, 'p2', [{ rank: '5', suit: 'hearts' }], 'hand'))
        .toThrow('Not player turn');
    });

    it('should throw error if playing zero cards', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      game.phase = 'playing';
      game.activePlayerId = 'p1';

      game.players.set('p1', {
        hand: [{ rank: '5', suit: 'hearts' }],
        faceUp: [],
        faceDown: [],
      });

      expect(() => playCards(game, 'p1', [], 'hand'))
        .toThrow('Must play at least one card');
    });

    it('should throw error if cards are different ranks', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      game.phase = 'playing';
      game.activePlayerId = 'p1';

      game.players.set('p1', {
        hand: [
          { rank: '5', suit: 'hearts' },
          { rank: '7', suit: 'diamonds' },
        ],
        faceUp: [],
        faceDown: [],
      });

      expect(() => playCards(game, 'p1', [
        { rank: '5', suit: 'hearts' },
        { rank: '7', suit: 'diamonds' },
      ], 'hand'))
        .toThrow('All cards must be the same rank');
    });

    it('should throw error if trying to play non-playable rank', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.pile = [{ rank: 'K', suit: 'spades' }];

      game.players.set('p1', {
        hand: [{ rank: '5', suit: 'hearts' }, { rank: '6', suit: 'diamonds' }],
        faceUp: [],
        faceDown: [],
      });

      expect(() => playCards(game, 'p1', [{ rank: '5', suit: 'hearts' }], 'hand'))
        .toThrow('No Playable Card');
    });

    it('should throw error when no cards are playable', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.pile = [{ rank: '9', suit: 'clubs' }];

      game.players.set('p1', {
        hand: [{ rank: '5', suit: 'hearts' }],
        faceUp: [],
        faceDown: [],
      });

      expect(() => playCards(game, 'p1', [{ rank: '5', suit: 'hearts' }], 'hand'))
        .toThrow('No Playable Card');
    });

    it('should throw "No Playable Card" if no cards can be played', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.pile = [{ rank: '9', suit: 'clubs' }];

      game.players.set('p1', {
        hand: [{ rank: '5', suit: 'hearts' }],
        faceUp: [],
        faceDown: [],
      });

      expect(() => playCards(game, 'p1', [{ rank: '5', suit: 'hearts' }], 'hand'))
        .toThrow('No Playable Card');
    });

    it('should throw error if player not found', () => {
      const game = initializeGame(['p1', 'p2'], testRoomId);
      game.phase = 'playing';
      game.activePlayerId = 'p999';

      expect(() => playCards(game, 'p999', [{ rank: '5', suit: 'hearts' }], 'hand'))
        .toThrow('Player not found');
    });
  });
});
