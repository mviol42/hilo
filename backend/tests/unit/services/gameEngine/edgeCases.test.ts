import { describe, it, expect } from 'vitest';
import {
  initializeGame,
  dealCards,
  selectFaceUpCards,
  playCards,
  pickupPile,
  isCardPlayable,
  getNextPlayerId,
  drawCardsToHand,
} from '../../../../src/services/gameEngine';
import { Card } from '@hilo/shared';

describe('Edge Cases and Advanced Scenarios', () => {
  const testRoomId = 'test-room-1';

  describe('Drawing Cards Edge Cases', () => {
    it('should not draw more cards than available in deck', () => {
      const game = initializeGame(['p1', 'p2']);
      game.phase = 'playing';
      game.deck = [{ rank: 'K', suit: 'spades' }];

      game.players.set('p1', {
        hand: [],
        faceUp: [],
        faceDown: [],
      });

      const newGame = drawCardsToHand(game, 'p1');

      const p1State = newGame.players.get('p1')!;
      expect(p1State.hand).toHaveLength(1);
      expect(newGame.deck).toHaveLength(0);
    });

    it('should not draw if player already has 3 or more cards', () => {
      const game = initializeGame(['p1', 'p2']);
      game.phase = 'playing';
      game.deck = [{ rank: 'K', suit: 'spades' }];

      game.players.set('p1', {
        hand: [
          { rank: '5', suit: 'hearts' },
          { rank: '6', suit: 'diamonds' },
          { rank: '7', suit: 'clubs' },
        ],
        faceUp: [],
        faceDown: [],
      });

      const newGame = drawCardsToHand(game, 'p1');

      const p1State = newGame.players.get('p1')!;
      expect(p1State.hand).toHaveLength(3);
      expect(newGame.deck).toHaveLength(1);
    });

    it('should draw exactly enough to reach 3 cards', () => {
      const game = initializeGame(['p1', 'p2']);
      game.phase = 'playing';
      game.deck = [
        { rank: 'K', suit: 'spades' },
        { rank: 'Q', suit: 'hearts' },
        { rank: 'J', suit: 'diamonds' },
      ];

      game.players.set('p1', {
        hand: [{ rank: '5', suit: 'hearts' }],
        faceUp: [],
        faceDown: [],
      });

      const newGame = drawCardsToHand(game, 'p1');

      const p1State = newGame.players.get('p1')!;
      expect(p1State.hand).toHaveLength(3);
      expect(newGame.deck).toHaveLength(1);
    });
  });

  describe('Turn Order Edge Cases', () => {
    it('should wrap around to first player after last player', () => {
      const game = initializeGame(['p1', 'p2', 'p3']);

      const nextPlayer = getNextPlayerId(game, 'p3');
      expect(nextPlayer).toBe('p1');
    });

    it('should handle two player turn order', () => {
      const game = initializeGame(['p1', 'p2']);

      expect(getNextPlayerId(game, 'p1')).toBe('p2');
      expect(getNextPlayerId(game, 'p2')).toBe('p1');
    });
  });

  describe('Special Rank Combinations', () => {
    it('should allow 2 to be played on 7 (going down)', () => {
      const pile: Card[] = [{ rank: '7', suit: 'hearts' }];
      const card: Card = { rank: '2', suit: 'diamonds' };

      expect(isCardPlayable(card, pile)).toBe(true);
    });

    it('should allow 2 to reset high pile', () => {
      const pile: Card[] = [{ rank: 'K', suit: 'hearts' }];
      const card: Card = { rank: '2', suit: 'diamonds' };

      expect(isCardPlayable(card, pile)).toBe(true);
    });

    it('should allow playing on multiple consecutive 8s', () => {
      const pile: Card[] = [
        { rank: '5', suit: 'hearts' },
        { rank: '8', suit: 'diamonds' },
        { rank: '8', suit: 'clubs' },
        { rank: '8', suit: 'spades' },
      ];

      expect(isCardPlayable({ rank: '5', suit: 'clubs' }, pile)).toBe(true);
      expect(isCardPlayable({ rank: '6', suit: 'clubs' }, pile)).toBe(true);
      expect(isCardPlayable({ rank: '7', suit: 'clubs' }, pile)).toBe(true);
      expect(isCardPlayable({ rank: '3', suit: 'clubs' }, pile)).toBe(false);
    });

    it('should handle 8 on top of 7 correctly', () => {
      const pile: Card[] = [
        { rank: '7', suit: 'hearts' },
        { rank: '8', suit: 'diamonds' },
      ];

      expect(isCardPlayable({ rank: '5', suit: 'clubs' }, pile)).toBe(true);
      expect(isCardPlayable({ rank: '7', suit: 'clubs' }, pile)).toBe(true);
      expect(isCardPlayable({ rank: '9', suit: 'clubs' }, pile)).toBe(false);
    });

    it('should allow playing 7 on 7', () => {
      const pile: Card[] = [{ rank: '7', suit: 'hearts' }];
      const card: Card = { rank: '7', suit: 'diamonds' };

      expect(isCardPlayable(card, pile)).toBe(true);
    });
  });

  describe('Complex Game Scenarios', () => {
    it('should handle full game from setup to playing', () => {
      const game = initializeGame(['p1', 'p2']);
      const dealtGame = dealCards(game);

      expect(dealtGame.phase).toBe('setup');

      for (const [playerId, state] of dealtGame.players) {
        expect(state.hand).toHaveLength(6);
        expect(state.faceDown).toHaveLength(3);
      }
    });

    it('should handle player playing all hand cards then face-up', () => {
      const game = initializeGame(['p1', 'p2']);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.deck = [];

      game.players.set('p1', {
        hand: [{ rank: '5', suit: 'hearts' }],
        faceUp: [{ rank: '7', suit: 'diamonds' }],
        faceDown: [],
      });
      game.players.set('p2', {
        hand: [],
        faceUp: [],
        faceDown: [],
      });

      const afterHandPlay = playCards(game, 'p1', [{ rank: '5', suit: 'hearts' }], 'hand');
      expect(afterHandPlay.activePlayerId).toBe('p2');

      afterHandPlay.activePlayerId = 'p1';
      const p1State = afterHandPlay.players.get('p1')!;
      expect(p1State.hand).toHaveLength(0);
      expect(p1State.faceUp).toHaveLength(1);

      const afterFaceUpPlay = playCards(afterHandPlay, 'p1', [{ rank: '7', suit: 'diamonds' }], 'faceUp');
      expect(afterFaceUpPlay.winner).toBe('p1');
    });

    it('should handle multiple blow ups in a row', () => {
      const game = initializeGame(['p1', 'p2']);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.deck = [];

      game.players.set('p1', {
        hand: [
          { rank: '10', suit: 'hearts' },
          { rank: '10', suit: 'diamonds' },
        ],
        faceUp: [],
        faceDown: [],
      });

      const firstBlowUp = playCards(game, 'p1', [{ rank: '10', suit: 'hearts' }], 'hand');
      expect(firstBlowUp.pile).toHaveLength(0);
      expect(firstBlowUp.activePlayerId).toBe('p1');

      const secondBlowUp = playCards(firstBlowUp, 'p1', [{ rank: '10', suit: 'diamonds' }], 'hand');
      expect(secondBlowUp.pile).toHaveLength(0);
      expect(secondBlowUp.discardPile).toHaveLength(2);
      expect(secondBlowUp.activePlayerId).toBe('p1');
    });
  });

  describe('Deck Management Edge Cases', () => {
    it('should handle running out of deck mid-game', () => {
      const game = initializeGame(['p1', 'p2', 'p3', 'p4', 'p5'], 'standard');
      const dealtGame = dealCards(game);

      const totalCardsDealt = Array.from(dealtGame.players.values())
        .reduce((sum, state) => sum + state.hand.length + state.faceDown.length, 0);

      const totalCards = totalCardsDealt + dealtGame.deck.length;
      // 5 players = 2 decks (104 cards) with standard strategy
      expect(totalCards).toBe(104);
    });
  });

  describe('Face-Down Card Edge Cases', () => {
    it('should handle playing unplayable face-down card', () => {
      const game = initializeGame(['p1', 'p2']);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.deck = [];
      game.pile = [
        { rank: 'K', suit: 'spades' },
        { rank: 'A', suit: 'diamonds' },
      ];

      game.players.set('p1', {
        hand: [],
        faceUp: [],
        faceDown: [{ rank: '3', suit: 'hearts' }],
      });

      const newGame = playCards(game, 'p1', [{ rank: '3', suit: 'hearts' }], 'faceDown', 0);

      const p1State = newGame.players.get('p1')!;
      expect(p1State.hand).toHaveLength(3);
      expect(p1State.faceDown).toHaveLength(1);
      expect(p1State.faceDown[0]).toBe(null);
      expect(newGame.pile).toHaveLength(0);
    });

    it('should handle playing playable face-down card that causes blow up', () => {
      const game = initializeGame(['p1', 'p2']);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.deck = [];
      game.pile = [];

      game.players.set('p1', {
        hand: [],
        faceUp: [],
        faceDown: [{ rank: '10', suit: 'hearts' }],
      });

      const newGame = playCards(game, 'p1', [{ rank: '10', suit: 'hearts' }], 'faceDown', 0);

      expect(newGame.pile).toHaveLength(0);
      expect(newGame.discardPile).toHaveLength(1);
      expect(newGame.winner).toBe('p1');
      expect(newGame.phase).toBe('ended');
    });
  });

  describe('Win Condition Edge Cases', () => {
    it('should handle winning with blow up on last card', () => {
      const game = initializeGame(['p1', 'p2']);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.deck = [];

      game.players.set('p1', {
        hand: [{ rank: '10', suit: 'hearts' }],
        faceUp: [],
        faceDown: [],
      });

      const newGame = playCards(game, 'p1', [{ rank: '10', suit: 'hearts' }], 'hand');

      expect(newGame.winner).toBe('p1');
      expect(newGame.phase).toBe('ended');
    });

    it('should handle winning with four of a kind on last cards', () => {
      const game = initializeGame(['p1', 'p2']);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.deck = [];
      game.pile = [
        { rank: '5', suit: 'hearts' },
        { rank: '5', suit: 'diamonds' },
        { rank: '5', suit: 'clubs' },
      ];

      game.players.set('p1', {
        hand: [{ rank: '5', suit: 'spades' }],
        faceUp: [],
        faceDown: [],
      });

      const newGame = playCards(game, 'p1', [{ rank: '5', suit: 'spades' }], 'hand');

      expect(newGame.winner).toBe('p1');
      expect(newGame.phase).toBe('ended');
    });
  });

  describe('Pile Pickup with Face-Up Cards Edge Cases', () => {
    it('should handle picking up with only one face-up card', () => {
      const game = initializeGame(['p1', 'p2']);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.pile = [{ rank: 'K', suit: 'spades' }];

      game.players.set('p1', {
        hand: [],
        faceUp: [{ rank: '3', suit: 'hearts' }],
        faceDown: [],
      });

      const newGame = pickupPile(game, 'p1');

      const p1State = newGame.players.get('p1')!;
      expect(p1State.hand).toHaveLength(2);
      expect(p1State.faceUp).toHaveLength(0);
    });

    it('should handle picking up with mixed face-up cards', () => {
      const game = initializeGame(['p1', 'p2']);
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.pile = [{ rank: 'A', suit: 'spades' }];

      game.players.set('p1', {
        hand: [],
        faceUp: [
          { rank: '3', suit: 'hearts' },
          { rank: '4', suit: 'diamonds' },
          { rank: '5', suit: 'clubs' },
        ],
        faceDown: [],
      });

      const newGame = pickupPile(game, 'p1');

      const p1State = newGame.players.get('p1')!;
      expect(p1State.hand).toHaveLength(2);
      expect(p1State.faceUp).toHaveLength(2);
    });
  });
});
