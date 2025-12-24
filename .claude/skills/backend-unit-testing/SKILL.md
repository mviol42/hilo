---
name: backend-unit-testing
description: Run backend unit tests using red-green-refactor TDD cycle. Use when implementing new backend features, fixing bugs, or when user mentions TDD, unit tests, or test-driven development for the backend.
---

# Backend Unit Testing (Red-Green-Refactor)

## Commands

```bash
# Run all unit tests
cd backend && npm test

# Run tests in watch mode (recommended during development)
cd backend && npm run test:watch

# Run specific test file
cd backend && npm test -- tests/unit/services/gameEngine.test.ts

# Run tests matching pattern
cd backend && npm test -- -t "should deal cards"

# Run with coverage
cd backend && npm run test:coverage
```

## Red-Green-Refactor Workflow

### 1. RED Phase
- Write a failing test first that describes the desired behavior
- Run `cd backend && npm test` to verify it fails
- The test failure message should clearly indicate what's missing

### 2. GREEN Phase
- Write the minimal code to make the test pass
- Don't over-engineer - just make it work
- Run `cd backend && npm test` to verify it passes

### 3. REFACTOR Phase
- Improve code quality without changing behavior
- Extract functions, rename variables, simplify logic
- Run `cd backend && npm test` after each change to ensure tests stay green

## Test File Structure

```
backend/tests/unit/
├── services/
│   ├── gameEngine.test.ts
│   ├── lobbyService.test.ts
│   └── deckService.test.ts
├── utils/
│   └── cardUtils.test.ts
└── handlers/
    └── gameHandlers.test.ts
```

Test files mirror the `src/` structure and are named `*.test.ts`.

## Example Test

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../src/services/gameEngine';

describe('GameEngine', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine();
  });

  describe('dealCards', () => {
    it('should deal 9 cards to each player', () => {
      const players = ['p1', 'p2'];
      const state = engine.dealCards(players);

      expect(state.players.get('p1')?.hand.length).toBe(3);
      expect(state.players.get('p1')?.faceUp.length).toBe(3);
      expect(state.players.get('p1')?.faceDown.length).toBe(3);
    });

    it('should fail with less than 2 players', () => {
      expect(() => engine.dealCards(['p1'])).toThrow();
    });
  });
});
```

## When This Skill Applies

- Implementing new service methods
- Adding game logic
- Writing utility functions
- Fixing bugs (write test to reproduce first, then fix)
- User asks to "add tests" or "use TDD"
