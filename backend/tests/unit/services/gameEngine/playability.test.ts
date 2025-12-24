import { describe, it, expect } from 'vitest';
import {
  isCardPlayable,
  getPlayableCards,
  getTopNonInvisibleCard,
  getRankValue,
  isSpecialRank,
} from '../../../../src/services/gameEngine';
import { Card } from '@hilo/shared';

describe('Card Playability', () => {
  describe('isSpecialRank', () => {
    it('should identify 2 as special', () => {
      expect(isSpecialRank('2')).toBe(true);
    });

    it('should identify 8 as special (invisible)', () => {
      expect(isSpecialRank('8')).toBe(true);
    });

    it('should identify 10 as special (blow up)', () => {
      expect(isSpecialRank('10')).toBe(true);
    });

    it('should not identify 7 as special', () => {
      expect(isSpecialRank('7')).toBe(false);
    });

    it('should not identify face cards as special', () => {
      expect(isSpecialRank('J')).toBe(false);
      expect(isSpecialRank('Q')).toBe(false);
      expect(isSpecialRank('K')).toBe(false);
      expect(isSpecialRank('A')).toBe(false);
    });
  });

  describe('getRankValue', () => {
    it('should return correct ordering for ranks', () => {
      expect(getRankValue('2')).toBe(0);
      expect(getRankValue('3')).toBe(1);
      expect(getRankValue('7')).toBe(5);
      expect(getRankValue('9')).toBe(6);
      expect(getRankValue('A')).toBe(10);
    });

    it('should have 9 higher than 7', () => {
      expect(getRankValue('9')).toBeGreaterThan(getRankValue('7'));
    });

    it('should have ace as highest', () => {
      expect(getRankValue('A')).toBe(10);
      expect(getRankValue('A')).toBeGreaterThan(getRankValue('K'));
    });

    it('should throw error for rank 8 (invisible)', () => {
      expect(() => getRankValue('8')).toThrow('Invalid rank for comparison: 8');
    });

    it('should throw error for rank 10 (blow up)', () => {
      expect(() => getRankValue('10')).toThrow('Invalid rank for comparison: 10');
    });
  });

  describe('getTopNonInvisibleCard', () => {
    it('should return null for empty pile', () => {
      expect(getTopNonInvisibleCard([])).toBeNull();
    });

    it('should return top card when not 8', () => {
      const pile: Card[] = [
        { rank: '5', suit: 'hearts' },
        { rank: '7', suit: 'diamonds' },
      ];

      const top = getTopNonInvisibleCard(pile);
      expect(top).toEqual({ rank: '7', suit: 'diamonds' });
    });

    it('should skip 8s and return first non-8 card', () => {
      const pile: Card[] = [
        { rank: '5', suit: 'hearts' },
        { rank: '8', suit: 'diamonds' },
        { rank: '8', suit: 'clubs' },
      ];

      const top = getTopNonInvisibleCard(pile);
      expect(top).toEqual({ rank: '5', suit: 'hearts' });
    });

    it('should return null if pile only contains 8s', () => {
      const pile: Card[] = [
        { rank: '8', suit: 'hearts' },
        { rank: '8', suit: 'diamonds' },
      ];

      expect(getTopNonInvisibleCard(pile)).toBeNull();
    });
  });

  describe('isCardPlayable - Special Cards', () => {
    it('should allow 2 on any pile', () => {
      const card: Card = { rank: '2', suit: 'hearts' };
      const pile: Card[] = [{ rank: 'A', suit: 'spades' }];

      expect(isCardPlayable(card, pile)).toBe(true);
    });

    it('should allow 8 on any pile', () => {
      const card: Card = { rank: '8', suit: 'hearts' };
      const pile: Card[] = [{ rank: 'K', suit: 'spades' }];

      expect(isCardPlayable(card, pile)).toBe(true);
    });

    it('should allow 10 on any pile', () => {
      const card: Card = { rank: '10', suit: 'hearts' };
      const pile: Card[] = [{ rank: '3', suit: 'spades' }];

      expect(isCardPlayable(card, pile)).toBe(true);
    });
  });

  describe('isCardPlayable - Empty Pile', () => {
    it('should allow any card on empty pile', () => {
      expect(isCardPlayable({ rank: '3', suit: 'hearts' }, [])).toBe(true);
      expect(isCardPlayable({ rank: '7', suit: 'hearts' }, [])).toBe(true);
      expect(isCardPlayable({ rank: 'K', suit: 'hearts' }, [])).toBe(true);
    });
  });

  describe('isCardPlayable - Top Card is 7', () => {
    const pile: Card[] = [{ rank: '7', suit: 'hearts' }];

    it('should allow ranks <= 7', () => {
      expect(isCardPlayable({ rank: '2', suit: 'hearts' }, pile)).toBe(true);
      expect(isCardPlayable({ rank: '3', suit: 'hearts' }, pile)).toBe(true);
      expect(isCardPlayable({ rank: '7', suit: 'diamonds' }, pile)).toBe(true);
    });

    it('should not allow ranks > 7', () => {
      expect(isCardPlayable({ rank: '9', suit: 'hearts' }, pile)).toBe(false);
      expect(isCardPlayable({ rank: 'J', suit: 'hearts' }, pile)).toBe(false);
      expect(isCardPlayable({ rank: 'A', suit: 'hearts' }, pile)).toBe(false);
    });
  });

  describe('isCardPlayable - Top Card is Not 7', () => {
    const pile: Card[] = [{ rank: '5', suit: 'hearts' }];

    it('should allow ranks >= top card', () => {
      expect(isCardPlayable({ rank: '5', suit: 'diamonds' }, pile)).toBe(true);
      expect(isCardPlayable({ rank: '6', suit: 'hearts' }, pile)).toBe(true);
      expect(isCardPlayable({ rank: '7', suit: 'hearts' }, pile)).toBe(true);
      expect(isCardPlayable({ rank: '9', suit: 'hearts' }, pile)).toBe(true);
      expect(isCardPlayable({ rank: 'K', suit: 'hearts' }, pile)).toBe(true);
    });

    it('should not allow ranks < top card', () => {
      expect(isCardPlayable({ rank: '3', suit: 'hearts' }, pile)).toBe(false);
      expect(isCardPlayable({ rank: '4', suit: 'hearts' }, pile)).toBe(false);
    });
  });

  describe('isCardPlayable - 8s are Invisible', () => {
    it('should ignore 8s on top and check card below', () => {
      const pile: Card[] = [
        { rank: '5', suit: 'hearts' },
        { rank: '8', suit: 'diamonds' },
      ];

      expect(isCardPlayable({ rank: '5', suit: 'clubs' }, pile)).toBe(true);
      expect(isCardPlayable({ rank: '6', suit: 'clubs' }, pile)).toBe(true);
      expect(isCardPlayable({ rank: '3', suit: 'clubs' }, pile)).toBe(false);
    });

    it('should ignore multiple 8s', () => {
      const pile: Card[] = [
        { rank: '7', suit: 'hearts' },
        { rank: '8', suit: 'diamonds' },
        { rank: '8', suit: 'clubs' },
      ];

      expect(isCardPlayable({ rank: '6', suit: 'clubs' }, pile)).toBe(true);
      expect(isCardPlayable({ rank: '9', suit: 'clubs' }, pile)).toBe(false);
    });

    it('should allow any card if pile only contains 8s', () => {
      const pile: Card[] = [
        { rank: '8', suit: 'hearts' },
        { rank: '8', suit: 'diamonds' },
      ];

      expect(isCardPlayable({ rank: '3', suit: 'clubs' }, pile)).toBe(true);
      expect(isCardPlayable({ rank: 'K', suit: 'clubs' }, pile)).toBe(true);
    });
  });

  describe('getPlayableCards', () => {
    it('should return all cards when pile is empty', () => {
      const cards: Card[] = [
        { rank: '3', suit: 'hearts' },
        { rank: '7', suit: 'diamonds' },
        { rank: 'K', suit: 'clubs' },
      ];

      const playable = getPlayableCards(cards, []);
      expect(playable).toHaveLength(3);
    });

    it('should filter out non-playable cards', () => {
      const cards: Card[] = [
        { rank: '3', suit: 'hearts' },
        { rank: '7', suit: 'diamonds' },
        { rank: 'K', suit: 'clubs' },
      ];
      const pile: Card[] = [{ rank: '5', suit: 'hearts' }];

      const playable = getPlayableCards(cards, pile);
      expect(playable).toHaveLength(2);
      expect(playable.find(c => c.rank === '7')).toBeDefined();
      expect(playable.find(c => c.rank === 'K')).toBeDefined();
    });

    it('should include special cards', () => {
      const cards: Card[] = [
        { rank: '3', suit: 'hearts' },
        { rank: '2', suit: 'diamonds' },
        { rank: '10', suit: 'clubs' },
      ];
      const pile: Card[] = [{ rank: 'K', suit: 'hearts' }];

      const playable = getPlayableCards(cards, pile);
      expect(playable).toHaveLength(2);
      expect(playable.find(c => c.rank === '2')).toBeDefined();
      expect(playable.find(c => c.rank === '10')).toBeDefined();
    });

    it('should return empty array when no cards are playable', () => {
      const cards: Card[] = [
        { rank: '3', suit: 'hearts' },
        { rank: '4', suit: 'diamonds' },
      ];
      const pile: Card[] = [{ rank: '9', suit: 'hearts' }];

      const playable = getPlayableCards(cards, pile);
      expect(playable).toHaveLength(0);
    });
  });
});
