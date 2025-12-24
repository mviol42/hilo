/**
 * Tests to verify shared constants can be imported and used
 */

import { describe, it, expect } from 'vitest';
import { RANK_ORDER, SPECIAL_RANKS } from '@hilo/shared';

describe('Shared Constants', () => {
  describe('RANK_ORDER', () => {
    it('should import RANK_ORDER array', () => {
      expect(RANK_ORDER).toBeDefined();
      expect(Array.isArray(RANK_ORDER)).toBe(true);
    });

    it('should contain all non-special ranks in order', () => {
      // 8 is excluded (invisible), 10 is excluded (blow up), 2 is included but special
      expect(RANK_ORDER).toHaveLength(11);
      expect(RANK_ORDER).toEqual(['2', '3', '4', '5', '6', '7', '9', 'J', 'Q', 'K', 'A']);
    });

    it('should not include 8 (invisible) or 10 (blow up)', () => {
      expect(RANK_ORDER).not.toContain('8');
      expect(RANK_ORDER).not.toContain('10');
    });

    it('should be ordered from lowest to highest', () => {
      expect(RANK_ORDER[0]).toBe('2');
      expect(RANK_ORDER[RANK_ORDER.length - 1]).toBe('A');
    });
  });

  describe('SPECIAL_RANKS', () => {
    it('should import SPECIAL_RANKS object', () => {
      expect(SPECIAL_RANKS).toBeDefined();
      expect(typeof SPECIAL_RANKS).toBe('object');
    });

    it('should define RESET as 2', () => {
      expect(SPECIAL_RANKS.RESET).toBe('2');
    });

    it('should define INVISIBLE as 8', () => {
      expect(SPECIAL_RANKS.INVISIBLE).toBe('8');
    });

    it('should define BLOW_UP as 10', () => {
      expect(SPECIAL_RANKS.BLOW_UP).toBe('10');
    });

    it('should have exactly 3 special ranks', () => {
      const keys = Object.keys(SPECIAL_RANKS);
      expect(keys).toHaveLength(3);
      expect(keys).toContain('RESET');
      expect(keys).toContain('INVISIBLE');
      expect(keys).toContain('BLOW_UP');
    });
  });

  describe('Constants Usage', () => {
    it('should use RANK_ORDER to compare card ranks', () => {
      // Example: Check if rank A is higher than rank 5
      const aIndex = RANK_ORDER.indexOf('A');
      const fiveIndex = RANK_ORDER.indexOf('5');

      expect(aIndex).toBeGreaterThan(fiveIndex);
    });

    it('should use SPECIAL_RANKS to identify special cards', () => {
      const rank = '2';
      const isReset = rank === SPECIAL_RANKS.RESET;

      expect(isReset).toBe(true);
    });

    it('should identify invisible cards', () => {
      const eight = '8';
      const isInvisible = eight === SPECIAL_RANKS.INVISIBLE;

      expect(isInvisible).toBe(true);
      expect(RANK_ORDER).not.toContain(eight);
    });
  });
});
