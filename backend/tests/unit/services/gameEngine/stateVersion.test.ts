/**
 * Unit tests for stateVersion incrementing in game engine
 *
 * Tests that stateVersion is correctly initialized and incremented
 * on every state mutation for idempotent state recovery.
 */

import { describe, it, expect } from 'vitest';
import {
  initializeGame,
  dealCards,
  selectFaceUpCards,
  startGame,
  playCards,
  pickupPile,
} from '../../../../src/services/gameEngine';
import type { GameState, Card } from '@hilo/shared';

describe('stateVersion', () => {
  describe('initialization', () => {
    it('should start with stateVersion 0', () => {
      const game = initializeGame(['p1', 'p2']);
      expect(game.stateVersion).toBe(0);
    });
  });

  describe('incrementing on mutations', () => {
    it('should increment after dealCards', () => {
      const game = initializeGame(['p1', 'p2']);
      const dealtGame = dealCards(game);

      expect(dealtGame.stateVersion).toBeGreaterThan(game.stateVersion);
    });

    it('should increment after selectFaceUpCards', () => {
      const game = initializeGame(['p1', 'p2']);
      const dealtGame = dealCards(game);
      const versionBeforeSelect = dealtGame.stateVersion;

      const selectedGame = selectFaceUpCards(dealtGame, 'p1', [0, 1, 2]);

      expect(selectedGame.stateVersion).toBeGreaterThan(versionBeforeSelect);
    });

    it('should increment after startGame', () => {
      const game = initializeGame(['p1', 'p2']);
      const dealtGame = dealCards(game);
      const p1Selected = selectFaceUpCards(dealtGame, 'p1', [0, 1, 2]);
      const p2Selected = selectFaceUpCards(p1Selected, 'p2', [0, 1, 2]);
      const versionBeforeStart = p2Selected.stateVersion;

      const startedGame = startGame(p2Selected);

      expect(startedGame.stateVersion).toBeGreaterThan(versionBeforeStart);
    });

    it('should increment after playCards', () => {
      // Setup a game in playing phase
      const game = initializeGame(['p1', 'p2']);
      const dealtGame = dealCards(game);
      const p1Selected = selectFaceUpCards(dealtGame, 'p1', [0, 1, 2]);
      const p2Selected = selectFaceUpCards(p1Selected, 'p2', [0, 1, 2]);
      const startedGame = startGame(p2Selected);

      const versionBeforePlay = startedGame.stateVersion;
      const activePlayer = startedGame.activePlayerId;
      const playerState = startedGame.players.get(activePlayer)!;

      // Play a card from hand
      if (playerState.hand.length > 0) {
        const cardToPlay = playerState.hand[0];
        const playedGame = playCards(startedGame, activePlayer, [cardToPlay], 'hand');
        expect(playedGame.stateVersion).toBeGreaterThan(versionBeforePlay);
      }
    });

    it('should increment after pickupPile', () => {
      // Setup a game where pickup is valid
      // We need to create a scenario where the player cannot play any cards

      // Create a controlled game state
      const game = initializeGame(['p1', 'p2']);

      // Manually set up a scenario for pickup
      // Player 1 has only high cards, pile has an Ace (highest non-special)
      game.players.set('p1', {
        hand: [
          { rank: '3', suit: 'hearts' },
          { rank: '4', suit: 'diamonds' },
          { rank: '5', suit: 'clubs' },
        ],
        faceUp: [
          { rank: '6', suit: 'spades' },
          { rank: '7', suit: 'hearts' },
          { rank: '8', suit: 'diamonds' },
        ],
        faceDown: [
          { rank: '9', suit: 'clubs' },
          { rank: '10', suit: 'spades' },
          { rank: 'J', suit: 'hearts' },
        ],
      });

      game.players.set('p2', {
        hand: [
          { rank: '3', suit: 'diamonds' },
          { rank: '4', suit: 'spades' },
          { rank: '5', suit: 'hearts' },
        ],
        faceUp: [
          { rank: '6', suit: 'clubs' },
          { rank: '7', suit: 'spades' },
          { rank: '9', suit: 'diamonds' },
        ],
        faceDown: [
          { rank: 'K', suit: 'clubs' },
          { rank: 'Q', suit: 'spades' },
          { rank: 'A', suit: 'hearts' },
        ],
      });

      // Set pile to have an Ace (King beats everything except special)
      game.pile = [{ rank: 'K', suit: 'clubs' }];
      game.phase = 'playing';
      game.activePlayerId = 'p1';
      game.stateVersion = 5;

      // p1 cannot play any cards (3,4,5,6,7,8 are all lower than King)
      // so they must pick up
      const versionBeforePickup = game.stateVersion;
      const afterPickup = pickupPile(game, 'p1');

      expect(afterPickup.stateVersion).toBeGreaterThan(versionBeforePickup);
    });
  });

  describe('monotonic increase', () => {
    it('should only ever increase, never decrease', () => {
      const game = initializeGame(['p1', 'p2']);
      let currentVersion = game.stateVersion;

      // Deal
      const dealtGame = dealCards(game);
      expect(dealtGame.stateVersion).toBeGreaterThan(currentVersion);
      currentVersion = dealtGame.stateVersion;

      // Select face-up for p1
      const p1Selected = selectFaceUpCards(dealtGame, 'p1', [0, 1, 2]);
      expect(p1Selected.stateVersion).toBeGreaterThan(currentVersion);
      currentVersion = p1Selected.stateVersion;

      // Select face-up for p2
      const p2Selected = selectFaceUpCards(p1Selected, 'p2', [0, 1, 2]);
      expect(p2Selected.stateVersion).toBeGreaterThan(currentVersion);
      currentVersion = p2Selected.stateVersion;

      // Start game
      const startedGame = startGame(p2Selected);
      expect(startedGame.stateVersion).toBeGreaterThan(currentVersion);
    });

    it('should increment by exactly 1 each time', () => {
      const game = initializeGame(['p1', 'p2']);
      expect(game.stateVersion).toBe(0);

      const dealtGame = dealCards(game);
      expect(dealtGame.stateVersion).toBe(1);

      const p1Selected = selectFaceUpCards(dealtGame, 'p1', [0, 1, 2]);
      expect(p1Selected.stateVersion).toBe(2);

      const p2Selected = selectFaceUpCards(p1Selected, 'p2', [0, 1, 2]);
      expect(p2Selected.stateVersion).toBe(3);

      const startedGame = startGame(p2Selected);
      expect(startedGame.stateVersion).toBe(4);
    });
  });

  describe('immutability', () => {
    it('should not mutate the original game state', () => {
      const game = initializeGame(['p1', 'p2']);
      const originalVersion = game.stateVersion;

      const dealtGame = dealCards(game);

      // Original should be unchanged
      expect(game.stateVersion).toBe(originalVersion);
      expect(dealtGame.stateVersion).toBeGreaterThan(originalVersion);
    });
  });
});
