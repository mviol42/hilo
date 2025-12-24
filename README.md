# Hi-Lo Card Game

A multiplayer card game implementation with TypeScript backend and real-time communication.

## Project Structure

```
hilo/
├── shared/                    # Shared TypeScript types
│   ├── types/                 # Type definitions
│   └── package.json
├── backend/                   # Backend server
│   ├── src/                   # Source code
│   ├── tests/                 # Tests
│   │   ├── unit/             # Unit tests
│   │   └── integration/      # Integration tests
│   └── package.json
├── client/                    # CLI client
│   ├── src/                   # Source code
│   └── package.json
├── .claude/                   # Claude Code skills
│   └── skills/
│       ├── backend-unit-testing/
│       └── backend-integration-testing/
└── .planning/                 # Implementation planning docs
    └── backend/
```

## Setup

### Install Dependencies

```bash
# Install all workspace dependencies
npm install

# Or install individually
cd shared && npm install
cd backend && npm install
cd client && npm install
```

### Build

```bash
# Build shared types first
cd shared && npm run build

# Build backend
cd backend && npm run build

# Build client
cd client && npm run build

# Or build everything
npm run build
```

## Development

### Run Backend Server

```bash
cd backend
npm run dev
```

The server will start on port 3000 (configurable via PORT environment variable).

### Run CLI Client

```bash
cd client
npm start
```

The client will connect to the backend server at `http://localhost:3000` (configurable via SERVER_URL environment variable).

For detailed client usage instructions, see [`client/README.md`](client/README.md).

### Testing

#### Unit Tests

```bash
cd backend
npm test                    # Run all unit tests (32 tests)
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage
```

**Current test coverage:**
- ✅ Shared type imports verification (17 tests)
- ✅ Shared constants verification (12 tests)
- ✅ Sample test suite (3 tests)

The shared types import tests verify that:
- All type definitions from `@hilo/shared` can be imported
- Card, Player, Lobby, Game, API, and Event types work correctly
- Constants (RANK_ORDER, SPECIAL_RANKS) are accessible
- Types can be used together in complex scenarios

#### Integration Tests

```bash
cd backend
npm run test:integration    # Run integration tests (5 tests)
npm run test:all           # Run all tests (37 total)
```

**Current integration tests:**
- ✅ Health check endpoint (3 tests)
- ✅ Server status verification (2 tests)

The integration tests verify that:
- Express server starts and responds to HTTP requests
- Health check endpoint returns correct status
- Socket.IO server is properly initialized
- Server cleanup works correctly

### Claude Code Skills

This project includes Claude Code skills to guide development workflows:

- **backend**: Overall backend development workflow and quality standards
  - Enforces planning before coding
  - Requires all tests to pass before completion
  - Ensures linting and build succeed
  - Provides Definition of Done checklist

- **backend-unit-testing**: Red-green-refactor TDD cycle
  - Unit test patterns and examples
  - Test organization guidelines

- **backend-integration-testing**: Integration testing workflows
  - HTTP API testing with supertest
  - WebSocket testing patterns

These skills are automatically discovered by Claude Code when working on the project.

## Technology Stack

- **Language**: TypeScript
- **Server**: Express.js
- **Real-time**: Socket.IO
- **Database**: Redis
- **Testing**: Vitest
- **Linting**: ESLint
- **Client**: Node.js CLI with Socket.IO client, Axios, Chalk

## Implementation Plan

See `.planning/backend/` for detailed implementation tasks and specifications.
