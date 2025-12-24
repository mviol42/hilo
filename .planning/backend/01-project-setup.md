# Task 1: Project Setup

## Objective

Initialize the backend project with all required dependencies, TypeScript configuration, project structure, shared types with frontend, and testing infrastructure.

## Subtasks

### 1.1 Initialize Node.js Project
- Create `package.json` with project metadata
- Configure npm scripts (dev, build, start, test)

### 1.2 Install Dependencies
- **Runtime**: express, socket.io, redis, uuid
- **Dev**: typescript, ts-node, @types/*, nodemon, eslint
- **Testing**: vitest, supertest, @types/supertest

### 1.3 Configure TypeScript
- Create `tsconfig.json` with strict mode enabled
- Configure path aliases for clean imports
- Set up build output directory
- Configure project references for shared types

### 1.4 Create Project Structure
```
hilo/
├── shared/                    # Shared TypeScript definitions
│   ├── types/
│   │   ├── card.ts           # Card, Rank, Suit
│   │   ├── player.ts         # Player, PlayerID
│   │   ├── game.ts           # GameState, GamePhase
│   │   ├── lobby.ts          # Lobby, LobbyState
│   │   ├── api.ts            # Request/Response types
│   │   ├── events.ts         # Socket.IO event types
│   │   └── index.ts          # Re-exports
│   ├── package.json
│   └── tsconfig.json
│
├── backend/
│   ├── src/
│   │   ├── index.ts          # Entry point
│   │   ├── server.ts         # Express + Socket.IO setup
│   │   ├── config/           # Configuration (Redis, server port, etc.)
│   │   ├── routes/           # HTTP route handlers
│   │   ├── handlers/         # Socket.IO event handlers
│   │   ├── services/         # Business logic (lobby, game engine)
│   │   └── utils/            # Helper functions
│   ├── tests/
│   │   ├── unit/             # Unit tests
│   │   └── integration/      # Integration tests
│   ├── package.json
│   ├── tsconfig.json
│   └── vitest.config.ts
│
└── frontend/                  # (imports from shared/)
```

### 1.5 Shared Types Package
- Create `shared/` folder at repository root
- Define all types used by both frontend and backend
- Configure as local npm package (workspace or file: reference)
- Both frontend and backend import from `@hilo/shared` or `shared`

**Shared type modules:**
- `card.ts` - Card, Rank, Suit types
- `player.ts` - Player, PlayerID types
- `game.ts` - GameState, GamePhase, PlayerGameState
- `lobby.ts` - Lobby, LobbyStatus
- `api.ts` - Request/Response types for HTTP endpoints
- `events.ts` - Socket.IO event names and payload types

### 1.6 Unit Testing Setup
- Install Vitest as test runner (fast, TypeScript-native)
- Configure `vitest.config.ts` for unit tests
- Set up test scripts in package.json:
  - `npm test` - Run all tests
  - `npm run test:watch` - Watch mode
  - `npm run test:coverage` - With coverage report
- Create sample test to verify setup works

### 1.7 Integration Testing Setup
- Configure separate Vitest config for integration tests
- Set up test database/Redis for integration tests
- Scripts:
  - `npm run test:integration` - Run integration tests
  - `npm run test:all` - Run unit + integration

### 1.8 Claude Code Skills
Create skill files in `.claude/skills/` for Claude Code to assist with development:

**`.claude/skills/backend-unit-testing/SKILL.md`**
- Red-green-refactor TDD workflow
- Commands: `npm test`, `npm run test:watch`, `npm run test:coverage`
- See `01a-skill-unit-testing.md` for full spec

**`.claude/skills/backend-integration-testing/SKILL.md`**
- HTTP API and WebSocket integration testing
- Commands: `npm run test:integration`, `npm run test:all`
- See `01b-skill-integration-testing.md` for full spec

## Acceptance Criteria

- [ ] Running `npm run dev` starts the server in watch mode
- [ ] Running `npm run build` produces valid JS output
- [ ] Running `npm test` runs all unit tests
- [ ] Running `npm run test:integration` runs integration tests
- [ ] TypeScript strict mode enabled with no errors
- [ ] All core type definitions in place in `shared/`
- [ ] Both backend and frontend can import from shared types
- [ ] SKILL.md files created for Claude Code workflows
