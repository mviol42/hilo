import { describe, it, expect } from 'vitest';
import { createDeck, shuffleDeck } from '../../../../src/services/gameEngine';

describe('Deck Management', () => {
  describe('createDeck - standard strategy (default)', () => {
    it('should create 1 full deck for 2-4 players', () => {
      const deck2 = createDeck(2, 'standard');
      const deck3 = createDeck(3, 'standard');
      const deck4 = createDeck(4, 'standard');

      expect(deck2).toHaveLength(52);
      expect(deck3).toHaveLength(52);
      expect(deck4).toHaveLength(52);
    });

    it('should create 2 full decks for 5-8 players', () => {
      const deck5 = createDeck(5, 'standard');
      const deck8 = createDeck(8, 'standard');

      expect(deck5).toHaveLength(104);
      expect(deck8).toHaveLength(104);
    });

    it('should create 3 full decks for 9-12 players', () => {
      const deck9 = createDeck(9, 'standard');
      const deck12 = createDeck(12, 'standard');

      expect(deck9).toHaveLength(156);
      expect(deck12).toHaveLength(156);
    });

    it('should create deck with all ranks and suits', () => {
      const deck = createDeck(2, 'standard');
      const ranks = new Set(deck.map(c => c.rank));
      const suits = new Set(deck.map(c => c.suit));

      expect(ranks.size).toBe(13);
      expect(suits.size).toBe(4);
      expect(ranks.has('2')).toBe(true);
      expect(ranks.has('A')).toBe(true);
      expect(suits.has('hearts')).toBe(true);
      expect(suits.has('spades')).toBe(true);
    });

    it('should have 4 cards of each rank in single deck', () => {
      const deck = createDeck(2, 'standard');
      const rankCounts = new Map<string, number>();

      for (const card of deck) {
        rankCounts.set(card.rank, (rankCounts.get(card.rank) || 0) + 1);
      }

      for (const count of rankCounts.values()) {
        expect(count).toBe(4);
      }
    });
  });

  describe('createDeck - quick strategy', () => {
    it('should create half the cards for 2-4 players', () => {
      const deck2 = createDeck(2, 'quick');
      const deck3 = createDeck(3, 'quick');
      const deck4 = createDeck(4, 'quick');

      expect(deck2).toHaveLength(26);
      expect(deck3).toHaveLength(26);
      expect(deck4).toHaveLength(26);
    });

    it('should create half the cards for 5-8 players', () => {
      const deck5 = createDeck(5, 'quick');
      const deck8 = createDeck(8, 'quick');

      expect(deck5).toHaveLength(52);
      expect(deck8).toHaveLength(52);
    });

    it('should have 2 cards of each rank in single deck', () => {
      const deck = createDeck(2, 'quick');
      const rankCounts = new Map<string, number>();

      for (const card of deck) {
        rankCounts.set(card.rank, (rankCounts.get(card.rank) || 0) + 1);
      }

      for (const count of rankCounts.values()) {
        expect(count).toBe(2);
      }
    });
  });

  describe('createDeck - mega-explosion strategy', () => {
    it('should create standard deck plus extra 10s for 2-4 players', () => {
      const deck2 = createDeck(2, 'mega-explosion');
      const deck3 = createDeck(3, 'mega-explosion');
      const deck4 = createDeck(4, 'mega-explosion');

      // Standard 52 + 4 extra 10s = 56
      expect(deck2).toHaveLength(56);
      expect(deck3).toHaveLength(56);
      expect(deck4).toHaveLength(56);
    });

    it('should create standard decks plus extra 10s for 5-8 players', () => {
      const deck5 = createDeck(5, 'mega-explosion');
      const deck8 = createDeck(8, 'mega-explosion');

      // 2 standard decks (104) + 8 extra 10s = 112
      expect(deck5).toHaveLength(112);
      expect(deck8).toHaveLength(112);
    });

    it('should have 8 tens in single deck (4 standard + 4 extra)', () => {
      const deck = createDeck(2, 'mega-explosion');
      const tensCount = deck.filter(c => c.rank === '10').length;

      expect(tensCount).toBe(8);
    });

    it('should have 4 cards of each non-10 rank in single deck', () => {
      const deck = createDeck(2, 'mega-explosion');
      const rankCounts = new Map<string, number>();

      for (const card of deck) {
        rankCounts.set(card.rank, (rankCounts.get(card.rank) || 0) + 1);
      }

      for (const [rank, count] of rankCounts.entries()) {
        if (rank === '10') {
          expect(count).toBe(8); // 4 standard + 4 extra
        } else {
          expect(count).toBe(4);
        }
      }
    });
  });

  describe('shuffleDeck', () => {
    it('should return deck with same length', () => {
      const deck = createDeck(2, 'standard');
      const shuffled = shuffleDeck(deck);

      expect(shuffled).toHaveLength(deck.length);
    });

    it('should contain all original cards', () => {
      const deck = createDeck(2, 'standard');
      const shuffled = shuffleDeck(deck);

      for (const card of deck) {
        const found = shuffled.find(c => c.rank === card.rank && c.suit === card.suit);
        expect(found).toBeDefined();
      }
    });

    it('should not modify original deck', () => {
      const deck = createDeck(2, 'standard');
      const originalFirst = deck[0];
      shuffleDeck(deck);

      expect(deck[0]).toEqual(originalFirst);
    });

    it('should likely produce different order (statistical test)', () => {
      const deck = createDeck(2, 'standard');
      const shuffled = shuffleDeck(deck);

      let differences = 0;
      for (let i = 0; i < deck.length; i++) {
        if (deck[i].rank !== shuffled[i].rank || deck[i].suit !== shuffled[i].suit) {
          differences++;
        }
      }

      expect(differences).toBeGreaterThan(10);
    });
  });
});
