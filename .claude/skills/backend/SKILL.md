---
name: backend-development
description: Backend development workflow for Hi-Lo game server. Use when implementing backend features, APIs, game logic, or any backend code. Enforces planning, testing, and quality standards before marking features complete.
---

# Backend Development Workflow

## Core Principles

Every backend feature implementation MUST follow this workflow:
1. **Plan** the implementation approach
2. **Implement** with tests (TDD when appropriate)
3. **Verify** all tests pass
4. **Lint** code for quality
5. **Complete** only when all checks pass

**A feature is NOT complete until:**
- ✅ All unit tests pass
- ✅ All integration tests pass (if applicable)
- ✅ Linting passes with no errors
- ✅ Code builds successfully

## Development Workflow

### Step 1: Plan the Implementation

Before writing code, create a plan that includes:

**For new features:**
- What endpoints/services are being added?
- What types from `@hilo/shared` will be used?
- What business logic is required?
- What edge cases need handling?
- How will this be tested (unit vs integration)?

**For bug fixes:**
- What is the root cause?
- What test can reproduce the bug?
- What is the minimal fix?

**Example planning questions:**
```
Q: What does this feature do?
Q: What tests are needed?
Q: What shared types will I use?
Q: Are there any edge cases?
Q: How will I verify it works?
```

### Step 2: Implement with Tests

Use **Test-Driven Development (TDD)** for new features:

1. **Write failing test first** (RED)
   ```bash
   cd backend && npm run test:watch
   ```

2. **Implement minimal code to pass** (GREEN)

3. **Refactor for quality** (REFACTOR)
   - Keep tests passing throughout

**Choose the right test type:**

**Unit Tests** (`tests/unit/`) for:
- Service methods (game engine, lobby management)
- Utility functions (card validation, rank comparison)
- Business logic (game rules, turn mechanics)

**Integration Tests** (`tests/integration/`) for:
- HTTP API endpoints
- WebSocket event flows
- End-to-end request/response scenarios

### Step 3: Run All Tests

Before considering a feature complete, verify:

```bash
# Run unit tests
cd backend && npm test

# Run integration tests
cd backend && npm run test:integration

# Run all tests
cd backend && npm run test:all
```

**All tests MUST pass.** If any fail:
- Fix the failing tests
- Do NOT skip or comment out tests
- Do NOT mark feature as complete

### Step 4: Lint the Code

Run linting to catch code quality issues:

```bash
cd backend && npm run lint
```

**Fix all linting errors** before completing:
- No unused variables
- No any types without justification
- Follow TypeScript best practices
- Consistent code style

### Step 5: Build Verification

Ensure the code compiles:

```bash
cd backend && npm run build
```

**The build MUST succeed.** If it fails:
- Fix TypeScript compilation errors
- Ensure all imports are correct
- Verify shared types are accessible

## Testing Guidelines

### Unit Test Requirements

**Every service method needs unit tests:**

```typescript
// tests/unit/services/gameEngine.test.ts
describe('GameEngine', () => {
  describe('dealCards', () => {
    it('should deal 9 cards to each player', () => {
      // Test implementation
    });

    it('should throw error with < 2 players', () => {
      // Test edge case
    });
  });
});
```

**Test coverage expectations:**
- Happy path (normal usage)
- Edge cases (boundary conditions)
- Error cases (invalid input)

### Integration Test Requirements

**Every HTTP endpoint needs integration tests:**

```typescript
// tests/integration/api/lobby.test.ts
describe('POST /api/lobby/create', () => {
  it('should create lobby and return ID', async () => {
    const response = await request(app)
      .post('/api/lobby/create')
      .expect(201);

    expect(response.body).toHaveProperty('lobbyId');
  });
});
```

**Every WebSocket event needs integration tests:**

```typescript
// tests/integration/websocket/lobby.test.ts
describe('lobby:join event', () => {
  it('should notify other players', async () => {
    // Test Socket.IO event
  });
});
```

## Code Quality Standards

### Type Safety

- ✅ Use types from `@hilo/shared` when available
- ✅ Avoid `any` types (use `unknown` if needed)
- ✅ Define interfaces for new data structures
- ❌ Don't use type assertions without justification

### Error Handling

- ✅ Validate input at API boundaries
- ✅ Return meaningful error messages
- ✅ Use proper HTTP status codes
- ✅ Log errors with context

### Code Organization

```
backend/src/
├── routes/          # HTTP route handlers (thin, delegate to services)
├── handlers/        # Socket.IO event handlers
├── services/        # Business logic (testable, pure functions)
├── utils/           # Helper functions
└── config/          # Configuration
```

- Keep route handlers thin (validation + service call)
- Put business logic in services (easily testable)
- Use dependency injection where appropriate

## Definition of Done Checklist

A task is complete when ALL of these are true:

```
☐ Code plan documented (approach, types, tests)
☐ Implementation follows TypeScript best practices
☐ Unit tests written and passing
☐ Integration tests written and passing (if API/WebSocket changes)
☐ All existing tests still pass
☐ Linting passes with no errors
☐ Build succeeds without TypeScript errors
☐ Shared types imported correctly from @hilo/shared
☐ Code reviewed for edge cases
☐ Error handling implemented
```

## Common Commands

```bash
# Development
cd backend && npm run dev              # Start server in watch mode

# Testing
cd backend && npm test                 # Unit tests
cd backend && npm run test:watch       # Unit tests (watch)
cd backend && npm run test:integration # Integration tests
cd backend && npm run test:all        # All tests

# Quality
cd backend && npm run lint            # Check code quality
cd backend && npm run build           # Verify TypeScript compilation

# From project root
npm run build                         # Build shared + backend
npm test                              # Run all backend tests
```

## When to Use This Skill

This skill applies when:
- Implementing new HTTP endpoints
- Adding game logic or business rules
- Creating new services or utilities
- Fixing bugs in backend code
- Adding WebSocket event handlers
- Modifying database/Redis interactions
- Any backend code changes

## Anti-Patterns to Avoid

❌ **Don't:**
- Skip writing tests ("I'll add them later")
- Mark features complete with failing tests
- Ignore linting errors
- Use `any` types everywhere
- Write untestable code (large functions, tight coupling)
- Skip the planning step
- Push code that doesn't build

✅ **Do:**
- Write tests first (or alongside) implementation
- Keep functions small and focused
- Use proper types from `@hilo/shared`
- Handle errors gracefully
- Plan before coding
- Verify all quality checks pass

## Examples

### Example: Adding a New Endpoint

**Step 1: Plan**
```
Feature: Create lobby endpoint
Types: LobbyId, CreateLobbyResponse from @hilo/shared
Service: LobbyService.createLobby()
Tests: Integration test for POST /api/lobby/create
Edge cases: None for creation
```

**Step 2: Write tests first**
```typescript
// tests/integration/api/lobby.test.ts
it('should create lobby', async () => {
  const response = await request(app)
    .post('/api/lobby/create')
    .expect(201);

  expect(response.body.lobbyId).toBeDefined();
});
```

**Step 3: Implement**
```typescript
// src/routes/lobby.ts
router.post('/create', async (req, res) => {
  const lobby = await lobbyService.createLobby();
  res.status(201).json({ lobbyId: lobby.id });
});
```

**Step 4: Verify**
```bash
npm run test:integration  # Should pass
npm run lint             # Should pass
npm run build            # Should succeed
```

**Step 5: Mark complete** ✅

This workflow ensures high-quality, well-tested backend code for the Hi-Lo game.
