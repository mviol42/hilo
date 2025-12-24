import { describe, it, expect } from 'vitest';
import {
  initializeGame,
  playCards,
  checkBlowUp,
  hasNoCards,
} from '../../../../src/services/gameEngine';
import { Card, PlayerGameState } from '@hilo/shared';

describe('Blow Up Mechanics', () => {
  describe('checkBlowUp', () => {
    it('should return true when top card is 10', () => {
      const pile: Card[] = [
        { rank: '5', suit: 'hearts' },
        { rank: '10', suit: 'diamonds' },
      ];

      expect(checkBlowUp(pile)).toBe(true);
    });

    it('should return true when last 4 cards are same rank', () => {
      const pile: Card[] = [
        { rank: '3', suit: 'hearts' },
        { rank: '5', suit: 'hearts' },
        { rank: '5', suit: 'diamonds' },
        { rank: '5', suit: 'clubs' },
        { rank: '5', suit: 'spades' },
      ];

      expect(checkBlowUp(pile)).toBe(true);
    });

    it('should return false when last 4 cards are not same rank', () => {
      const pile: Card[] = [
        { rank: '5', suit: 'hearts' },
        { rank: '5', suit: 'diamonds' },
        { rank: '5', suit: 'clubs' },
        { rank: '7', suit: 'spades' },
      ];

      expect(checkBlowUp(pile)).toBe(false);
    });

    it('should return false when pile has less than 4 cards', () => {
      const pile: Card[] = [
        { rank: '5', suit: 'hearts' },
        { rank: '5', suit: 'diamonds' },
        { rank: '5', suit: 'clubs' },
      ];

      expect(checkBlowUp(pile)).toBe(false);
    });

    it('should NOT ignore 8s for blow up check', () => {
      const pile: Card[] = [
        { rank: '5', suit: 'hearts' },
        { rank: '5', suit: 'diamonds' },
        { rank: '5', suit: 'clubs' },
        { rank: '8', suit: 'spades' },
      ];

      expect(checkBlowUp(pile)).toBe(false);
    });

    it('should blow up with four 8s', () => {
      const pile: Card[] = [
        { rank: '8', suit: 'hearts' },
        { rank: '8', suit: 'diamonds' },
        { rank: '8', suit: 'clubs' },
        { rank: '8', suit: 'spades' },
      ];

      expect(checkBlowUp(pile)).toBe(true);
    });

    it('should return false for empty pile', () => {
      expect(checkBlowUp([])).toBe(false);
    });
  });

  describe('playCards - Blow Up with 10', () => {
    it('should blow up pile when playing 10', () => {
      const game = initializeGame(['p1', 'p2']);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.pile = [{ rank: '5', suit: 'clubs' }];
      game.deck = [];

      game.players.set('p1', {
        hand: [{ rank: '10', suit: 'hearts' }],
        faceUp: [],
        faceDown: [],
      });

      const newGame = playCards(game, 'p1', [{ rank: '10', suit: 'hearts' }], 'hand');

      expect(newGame.pile).toHaveLength(0);
      expect(newGame.discardPile).toHaveLength(2);
      expect(newGame.activePlayerId).toBe('p1');
    });

    it('should give player another turn after blowing up', () => {
      const game = initializeGame(['p1', 'p2', 'p3']);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.deck = [];

      game.players.set('p1', {
        hand: [{ rank: '10', suit: 'hearts' }],
        faceUp: [],
        faceDown: [],
      });

      const newGame = playCards(game, 'p1', [{ rank: '10', suit: 'hearts' }], 'hand');

      expect(newGame.activePlayerId).toBe('p1');
    });
  });

  describe('playCards - Blow Up with Four of a Kind', () => {
    it('should blow up when completing four of same rank', () => {
      const game = initializeGame(['p1', 'p2']);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.pile = [
        { rank: '5', suit: 'hearts' },
        { rank: '5', suit: 'diamonds' },
        { rank: '5', suit: 'clubs' },
      ];
      game.deck = [];

      game.players.set('p1', {
        hand: [{ rank: '5', suit: 'spades' }],
        faceUp: [],
        faceDown: [],
      });

      const newGame = playCards(game, 'p1', [{ rank: '5', suit: 'spades' }], 'hand');

      expect(newGame.pile).toHaveLength(0);
      expect(newGame.discardPile).toHaveLength(4);
      expect(newGame.activePlayerId).toBe('p1');
    });

    it('should blow up when playing multiple cards to complete four', () => {
      const game = initializeGame(['p1', 'p2']);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.pile = [
        { rank: '7', suit: 'hearts' },
        { rank: '7', suit: 'diamonds' },
      ];
      game.deck = [];

      game.players.set('p1', {
        hand: [
          { rank: '7', suit: 'clubs' },
          { rank: '7', suit: 'spades' },
        ],
        faceUp: [],
        faceDown: [],
      });

      const newGame = playCards(game, 'p1', [
        { rank: '7', suit: 'clubs' },
        { rank: '7', suit: 'spades' },
      ], 'hand');

      expect(newGame.pile).toHaveLength(0);
      expect(newGame.discardPile).toHaveLength(4);
    });

    it('should not blow up with only 3 of same rank', () => {
      const game = initializeGame(['p1', 'p2']);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.pile = [
        { rank: '5', suit: 'hearts' },
        { rank: '5', suit: 'diamonds' },
      ];
      game.deck = [];

      game.players.set('p1', {
        hand: [{ rank: '5', suit: 'clubs' }],
        faceUp: [],
        faceDown: [{ rank: '3', suit: 'spades' }],
      });
      game.players.set('p2', {
        hand: [{ rank: '7', suit: 'spades' }],
        faceUp: [],
        faceDown: [],
      });

      const newGame = playCards(game, 'p1', [{ rank: '5', suit: 'clubs' }], 'hand');

      expect(newGame.pile).toHaveLength(3);
      expect(newGame.discardPile).toHaveLength(0);
      expect(newGame.activePlayerId).toBe('p2');
    });
  });

  describe('hasNoCards', () => {
    it('should return true when player has no cards', () => {
      const playerState: PlayerGameState = {
        hand: [],
        faceUp: [],
        faceDown: [],
      };

      expect(hasNoCards(playerState)).toBe(true);
    });

    it('should return false when player has hand cards', () => {
      const playerState: PlayerGameState = {
        hand: [{ rank: '5', suit: 'hearts' }],
        faceUp: [],
        faceDown: [],
      };

      expect(hasNoCards(playerState)).toBe(false);
    });

    it('should return false when player has face-up cards', () => {
      const playerState: PlayerGameState = {
        hand: [],
        faceUp: [{ rank: '5', suit: 'hearts' }],
        faceDown: [],
      };

      expect(hasNoCards(playerState)).toBe(false);
    });

    it('should return false when player has face-down cards', () => {
      const playerState: PlayerGameState = {
        hand: [],
        faceUp: [],
        faceDown: [{ rank: '5', suit: 'hearts' }],
      };

      expect(hasNoCards(playerState)).toBe(false);
    });
  });

  describe('Win Condition', () => {
    it('should set winner when player runs out of cards', () => {
      const game = initializeGame(['p1', 'p2']);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.deck = [];

      game.players.set('p1', {
        hand: [{ rank: '5', suit: 'hearts' }],
        faceUp: [],
        faceDown: [],
      });

      const newGame = playCards(game, 'p1', [{ rank: '5', suit: 'hearts' }], 'hand');

      expect(newGame.winner).toBe('p1');
      expect(newGame.phase).toBe('ended');
    });

    it('should not set winner if player still has face-up cards', () => {
      const game = initializeGame(['p1', 'p2']);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.deck = [];

      game.players.set('p1', {
        hand: [{ rank: '5', suit: 'hearts' }],
        faceUp: [{ rank: '7', suit: 'diamonds' }],
        faceDown: [],
      });

      const newGame = playCards(game, 'p1', [{ rank: '5', suit: 'hearts' }], 'hand');

      expect(newGame.winner).toBeUndefined();
      expect(newGame.phase).toBe('playing');
    });

    it('should not set winner if player still has face-down cards', () => {
      const game = initializeGame(['p1', 'p2']);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.deck = [];

      game.players.set('p1', {
        hand: [{ rank: '5', suit: 'hearts' }],
        faceUp: [],
        faceDown: [{ rank: '7', suit: 'diamonds' }],
      });

      const newGame = playCards(game, 'p1', [{ rank: '5', suit: 'hearts' }], 'hand');

      expect(newGame.winner).toBeUndefined();
      expect(newGame.phase).toBe('playing');
    });

    it('should win when playing last face-down card', () => {
      const game = initializeGame(['p1', 'p2']);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.deck = [];

      game.players.set('p1', {
        hand: [],
        faceUp: [],
        faceDown: [{ rank: '7', suit: 'hearts' }],
      });

      const newGame = playCards(game, 'p1', [{ rank: '7', suit: 'hearts' }], 'faceDown', 0);

      expect(newGame.winner).toBe('p1');
      expect(newGame.phase).toBe('ended');
    });
  });
});
