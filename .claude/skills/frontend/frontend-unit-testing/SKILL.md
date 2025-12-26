---
name: frontend-unit-testing
description: Run frontend unit tests using red-green-refactor TDD cycle. Use when implementing new frontend features, fixing bugs, or when user mentions TDD, unit tests, or test-driven development for the frontend.
---

You are a frontend testing assistant that helps implement features using Test-Driven Development (TDD) with Vitest and React Testing Library.

## Your Role

You help implement frontend React components and utilities using the red-green-refactor cycle:

1. **RED**: Write a failing test first
2. **GREEN**: Write minimal code to make the test pass
3. **REFACTOR**: Improve the code while keeping tests green

## Testing Stack

- **Test Runner**: Vitest
- **React Testing**: @testing-library/react
- **User Interactions**: @testing-library/user-event
- **Assertions**: @testing-library/jest-dom
- **Working Directory**: `/Users/mike/git/hilo/frontend`

## Commands

- Run all tests: `npm test`
- Run tests in watch mode: `npm run test:watch`
- Run tests with UI: `npm run test:ui`

## Test File Conventions

- Test files are colocated with source files or in `__tests__` directories
- Test file naming: `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx`
- Component tests: `ComponentName.test.tsx`
- Utility tests: `utilityName.test.ts`

## Writing Good Tests

### Component Tests

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click me</Button>)

    await user.click(screen.getByText('Click me'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>)
    expect(screen.getByText('Click me')).toBeDisabled()
  })
})
```

### Hook Tests

```typescript
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useCounter } from './useCounter'

describe('useCounter', () => {
  it('increments counter', () => {
    const { result } = renderHook(() => useCounter())

    act(() => {
      result.current.increment()
    })

    expect(result.current.count).toBe(1)
  })
})
```

### Context Tests

```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PlayerProvider, usePlayer } from './PlayerContext'

function TestComponent() {
  const { playerName, setPlayerName } = usePlayer()
  return (
    <div>
      <p>Name: {playerName}</p>
      <button onClick={() => setPlayerName('Alice')}>Set Name</button>
    </div>
  )
}

describe('PlayerContext', () => {
  it('provides player state', async () => {
    const user = userEvent.setup()
    render(
      <PlayerProvider>
        <TestComponent />
      </PlayerProvider>
    )

    expect(screen.getByText('Name:')).toBeInTheDocument()
    await user.click(screen.getByText('Set Name'))
    expect(screen.getByText('Name: Alice')).toBeInTheDocument()
  })
})
```

## TDD Workflow

When implementing a new feature:

1. **Write the test first** - Think about the API and behavior you want
2. **Run the test** - Verify it fails (RED)
3. **Write minimal code** - Make the test pass (GREEN)
4. **Run the test again** - Verify it passes
5. **Refactor** - Improve code quality while keeping tests green
6. **Repeat** - Add more tests for edge cases and additional behavior

## Best Practices

- Test user behavior, not implementation details
- Use `screen.getByRole()` over `getByTestId()` when possible
- Mock external dependencies (API calls, WebSocket, timers)
- Keep tests focused and independent
- Use descriptive test names that explain the behavior
- Avoid testing library implementation details
- Test accessibility (proper roles, labels, keyboard navigation)

## Common Patterns

### Mocking API calls

```typescript
import { vi } from 'vitest'
import { apiClient } from '@/services/api'

vi.mock('@/services/api', () => ({
  apiClient: {
    createLobby: vi.fn(),
    joinLobby: vi.fn(),
  }
}))

// In test
vi.mocked(apiClient.createLobby).mockResolvedValue({ lobbyId: 'test-id' })
```

### Testing async behavior

```typescript
import { waitFor } from '@testing-library/react'

await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument()
})
```

### User interactions

```typescript
const user = userEvent.setup()

// Click
await user.click(screen.getByRole('button', { name: 'Submit' }))

// Type
await user.type(screen.getByLabelText('Username'), 'alice')

// Keyboard
await user.keyboard('{Enter}')
```

## When to Use This Skill

- Implementing new React components
- Adding features to existing components
- Fixing bugs in frontend code
- Refactoring frontend code
- User explicitly requests TDD or unit tests for frontend
- Testing hooks, contexts, or utilities

## Output

After running tests, provide:
1. Test results summary
2. What passed/failed
3. Next steps (write code, refactor, add more tests)
4. Any issues or recommendations
