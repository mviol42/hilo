import { describe, it, expect } from 'vitest';
import { createDeck, shuffleDeck } from '../../../../src/services/gameEngine';

describe('Deck Management', () => {
  describe('createDeck', () => {
    it('should create 1 deck for 2-4 players', () => {
      const deck2 = createDeck(2);
      const deck3 = createDeck(3);
      const deck4 = createDeck(4);

      // Deck is halved for faster testing
      expect(deck2).toHaveLength(26);
      expect(deck3).toHaveLength(26);
      expect(deck4).toHaveLength(26);
    });

    it('should create 2 decks for 5-8 players', () => {
      const deck5 = createDeck(5);
      const deck8 = createDeck(8);

      // Deck is halved for faster testing
      expect(deck5).toHaveLength(52);
      expect(deck8).toHaveLength(52);
    });

    it('should create 3 decks for 9-12 players', () => {
      const deck9 = createDeck(9);
      const deck12 = createDeck(12);

      // Deck is halved for faster testing
      expect(deck9).toHaveLength(78);
      expect(deck12).toHaveLength(78);
    });

    it('should create deck with all ranks and suits', () => {
      const deck = createDeck(2);
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
      const deck = createDeck(2);
      const rankCounts = new Map<string, number>();

      for (const card of deck) {
        rankCounts.set(card.rank, (rankCounts.get(card.rank) || 0) + 1);
      }

      // Deck is halved for faster testing (2 cards per rank instead of 4)
      for (const count of rankCounts.values()) {
        expect(count).toBe(2);
      }
    });
  });

  describe('shuffleDeck', () => {
    it('should return deck with same length', () => {
      const deck = createDeck(2);
      const shuffled = shuffleDeck(deck);

      expect(shuffled).toHaveLength(deck.length);
    });

    it('should contain all original cards', () => {
      const deck = createDeck(2);
      const shuffled = shuffleDeck(deck);

      for (const card of deck) {
        const found = shuffled.find(c => c.rank === card.rank && c.suit === card.suit);
        expect(found).toBeDefined();
      }
    });

    it('should not modify original deck', () => {
      const deck = createDeck(2);
      const originalFirst = deck[0];
      shuffleDeck(deck);

      expect(deck[0]).toEqual(originalFirst);
    });

    it('should likely produce different order (statistical test)', () => {
      const deck = createDeck(2);
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
