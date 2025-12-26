import { describe, it, expect } from 'vitest';
import {
  initializeGame,
  pickupPile,
  GameEngineError,
} from '../../../../src/services/gameEngine';
import { Card } from '@hilo/shared';

describe('Pickup Pile', () => {
  const testRoomId = 'test-room-1';

  describe('pickupPile - From Hand', () => {
    it('should pickup pile when no cards in hand are playable', () => {
      const game = initializeGame(['p1', 'p2']);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.pile = [
        { rank: '9', suit: 'clubs' },
        { rank: 'K', suit: 'spades' },
      ];

      game.players.set('p1', {
        hand: [{ rank: '5', suit: 'hearts' }],
        faceUp: [],
        faceDown: [],
      });

      const newGame = pickupPile(game, 'p1');

      const p1State = newGame.players.get('p1')!;
      expect(p1State.hand).toHaveLength(3);
      expect(newGame.pile).toHaveLength(0);
    });

    it('should move to next player after picking up', () => {
      const game = initializeGame(['p1', 'p2', 'p3']);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.pile = [{ rank: 'K', suit: 'spades' }];

      game.players.set('p1', {
        hand: [{ rank: '5', suit: 'hearts' }],
        faceUp: [],
        faceDown: [],
      });

      const newGame = pickupPile(game, 'p1');

      expect(newGame.activePlayerId).toBe('p2');
    });

    it('should throw error if playable cards exist in hand', () => {
      const game = initializeGame(['p1', 'p2']);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.pile = [{ rank: '5', suit: 'clubs' }];

      game.players.set('p1', {
        hand: [{ rank: '7', suit: 'hearts' }],
        faceUp: [],
        faceDown: [],
      });

      expect(() => pickupPile(game, 'p1'))
        .toThrow('Must play a card if possible');
    });
  });

  describe('pickupPile - From Face-Up', () => {
    it('should pickup pile and add same-rank face-up cards when hand is empty', () => {
      const game = initializeGame(['p1', 'p2']);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.pile = [{ rank: 'K', suit: 'spades' }];

      game.players.set('p1', {
        hand: [],
        faceUp: [
          { rank: '5', suit: 'hearts' },
          { rank: '5', suit: 'diamonds' },
          { rank: '7', suit: 'clubs' },
        ],
        faceDown: [],
      });

      const newGame = pickupPile(game, 'p1');

      const p1State = newGame.players.get('p1')!;
      expect(p1State.hand).toHaveLength(3);
      expect(p1State.faceUp).toHaveLength(1);
      expect(p1State.faceUp[0].rank).toBe('7');
      expect(newGame.pile).toHaveLength(0);
    });

    it('should add all same-rank face-up cards to hand', () => {
      const game = initializeGame(['p1', 'p2']);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.pile = [{ rank: 'K', suit: 'spades' }];

      game.players.set('p1', {
        hand: [],
        faceUp: [
          { rank: '5', suit: 'hearts' },
          { rank: '5', suit: 'diamonds' },
          { rank: '5', suit: 'clubs' },
        ],
        faceDown: [],
      });

      const newGame = pickupPile(game, 'p1');

      const p1State = newGame.players.get('p1')!;
      expect(p1State.hand).toHaveLength(4);
      expect(p1State.faceUp).toHaveLength(0);
    });

    it('should throw error if playable face-up cards exist', () => {
      const game = initializeGame(['p1', 'p2']);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.pile = [{ rank: '5', suit: 'clubs' }];

      game.players.set('p1', {
        hand: [],
        faceUp: [{ rank: '7', suit: 'hearts' }],
        faceDown: [],
      });

      expect(() => pickupPile(game, 'p1'))
        .toThrow('Must play a card if possible');
    });
  });

  describe('pickupPile - Error Cases', () => {
    it('should throw error if not player turn', () => {
      const game = initializeGame(['p1', 'p2']);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.pile = [{ rank: 'K', suit: 'spades' }];

      game.players.set('p2', {
        hand: [{ rank: '5', suit: 'hearts' }],
        faceUp: [],
        faceDown: [],
      });

      expect(() => pickupPile(game, 'p2'))
        .toThrow('Not player turn');
    });

    it('should throw error when playing face-down cards', () => {
      const game = initializeGame(['p1', 'p2']);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.pile = [{ rank: 'K', suit: 'spades' }];

      game.players.set('p1', {
        hand: [],
        faceUp: [],
        faceDown: [{ rank: '5', suit: 'hearts' }],
      });

      expect(() => pickupPile(game, 'p1'))
        .toThrow('Cannot pick up pile when playing face-down cards');
    });

    it('should throw error if player not found', () => {
      const game = initializeGame(['p1', 'p2']);
      game.phase = 'playing';
      game.activePlayerId = 'p999';

      expect(() => pickupPile(game, 'p999'))
        .toThrow('Player not found');
    });
  });

  describe('pickupPile - Empty Pile', () => {
    it('should handle empty pile correctly', () => {
      const game = initializeGame(['p1', 'p2']);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.pile = [];

      game.players.set('p1', {
        hand: [{ rank: '5', suit: 'hearts' }],
        faceUp: [],
        faceDown: [],
      });

      expect(() => pickupPile(game, 'p1'))
        .toThrow('Must play a card if possible');
    });
  });
});
