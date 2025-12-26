# Task 8: Shared Components

## Goal

Create reusable UI components used throughout the application.

## Prerequisites

- Task 1: Project Setup completed

## Components to Build

### 1. Card Component

The most important component - displays a playing card with various states.

Create `src/components/Card/index.tsx`:
```typescript
import { Card as CardType } from '@hilo/shared'
import './Card.css'

interface CardProps {
  card: CardType
  size?: 'small' | 'medium' | 'large'
  faceDown?: boolean
  selectable?: boolean
  selected?: boolean
  playable?: boolean
  dimmed?: boolean
  onClick?: () => void
}

const suitSymbols: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
}

const suitColors: Record<string, string> = {
  hearts: 'red',
  diamonds: 'red',
  clubs: 'black',
  spades: 'black',
}

export function Card({
  card,
  size = 'medium',
  faceDown = false,
  selectable = false,
  selected = false,
  playable = false,
  dimmed = false,
  onClick,
}: CardProps) {
  const suitSymbol = suitSymbols[card.suit] || card.suit
  const suitColor = suitColors[card.suit] || 'black'

  const classNames = [
    'card',
    `card-${size}`,
    faceDown ? 'card-facedown' : '',
    selectable ? 'card-selectable' : '',
    selected ? 'card-selected' : '',
    playable ? 'card-playable' : '',
    dimmed ? 'card-dimmed' : '',
    `card-${suitColor}`,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classNames} onClick={selectable ? onClick : undefined}>
      {faceDown ? (
        <div className="card-back">
          <div className="card-back-pattern"></div>
        </div>
      ) : (
        <>
          <div className="card-rank">{card.rank}</div>
          <div className="card-suit">{suitSymbol}</div>
        </>
      )}
    </div>
  )
}
```

Create `src/components/Card/Card.css`:
```css
.card {
  position: relative;
  background: white;
  border: 2px solid #333;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s, box-shadow 0.2s;
  user-select: none;
}

/* Sizes */
.card-small {
  width: 50px;
  height: 70px;
  font-size: 1rem;
}

.card-medium {
  width: 70px;
  height: 100px;
  font-size: 1.5rem;
}

.card-large {
  width: 100px;
  height: 140px;
  font-size: 2rem;
}

/* Colors */
.card-red .card-rank,
.card-red .card-suit {
  color: #ef4444;
}

.card-black .card-rank,
.card-black .card-suit {
  color: #1f2937;
}

/* States */
.card-selectable {
  cursor: pointer;
}

.card-selectable:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.card-selected {
  border-color: #3b82f6;
  background: #eff6ff;
  transform: translateY(-8px);
  box-shadow: 0 6px 12px rgba(59, 130, 246, 0.3);
}

.card-playable {
  animation: pulse-green 4s ease-in-out infinite;
}

@keyframes pulse-green {
  0%, 100% {
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  50% {
    box-shadow: 0 0 20px rgba(34, 197, 94, 0.6);
    border-color: #22c55e;
  }
}

.card-dimmed {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Face down card */
.card-facedown {
  background: linear-gradient(135deg, #1e40af 0%, #3730a3 100%);
  border-color: #1e3a8a;
}

.card-back-pattern {
  width: 80%;
  height: 80%;
  background: repeating-linear-gradient(
    45deg,
    #2563eb,
    #2563eb 10px,
    #1e40af 10px,
    #1e40af 20px
  );
  border-radius: 4px;
}

/* Card content */
.card-rank {
  font-size: inherit;
  line-height: 1;
}

.card-suit {
  font-size: 1.2em;
  line-height: 1;
  margin-top: 0.2em;
}
```

### 2. Button Component

Create `src/components/Button/index.tsx`:
```typescript
import './Button.css'

interface ButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'small' | 'medium' | 'large'
  fullWidth?: boolean
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  disabled = false,
  type = 'button',
}: ButtonProps) {
  const classNames = [
    'btn',
    `btn-${variant}`,
    `btn-${size}`,
    fullWidth ? 'btn-fullwidth' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type={type}
      className={classNames}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}
```

Create `src/components/Button/Button.css`:
```css
.btn {
  font-weight: 600;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Variants */
.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #4b5563;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
}

/* Sizes */
.btn-small {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
}

.btn-medium {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
}

.btn-large {
  padding: 1rem 2rem;
  font-size: 1.125rem;
}

.btn-fullwidth {
  width: 100%;
}
```

### 3. Input Component

Create `src/components/Input/index.tsx`:
```typescript
import './Input.css'

interface InputProps {
  type?: 'text' | 'email' | 'password'
  placeholder?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onBlur?: () => void
  onKeyPress?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  error?: boolean
  disabled?: boolean
  maxLength?: number
}

export function Input({
  type = 'text',
  placeholder,
  value,
  onChange,
  onBlur,
  onKeyPress,
  error = false,
  disabled = false,
  maxLength,
}: InputProps) {
  const classNames = ['input', error ? 'input-error' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <input
      type={type}
      className={classNames}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      onKeyPress={onKeyPress}
      disabled={disabled}
      maxLength={maxLength}
    />
  )
}
```

Create `src/components/Input/Input.css`:
```css
.input {
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  border: 2px solid #d1d5db;
  border-radius: 0.5rem;
  font-family: inherit;
  transition: border-color 0.2s;
}

.input:focus {
  outline: none;
  border-color: #3b82f6;
}

.input:disabled {
  background: #f3f4f6;
  cursor: not-allowed;
}

.input-error {
  border-color: #ef4444;
}

.input-error:focus {
  border-color: #dc2626;
}
```

### 4. Toast Component

Create `src/components/Toast/index.tsx`:
```typescript
import { useUI } from '@/context'
import './Toast.css'

export function ToastContainer() {
  const { toasts, removeToast } = useUI()

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast-${toast.type}`}
          onClick={() => removeToast(toast.id)}
        >
          <span>{toast.message}</span>
          <button className="toast-close">&times;</button>
        </div>
      ))}
    </div>
  )
}
```

Create `src/components/Toast/Toast.css`:
```css
.toast-container {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 400px;
}

.toast {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  color: white;
  font-weight: 500;
  animation: slideIn 0.3s ease-out;
  cursor: pointer;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.toast-success {
  background: #10b981;
}

.toast-error {
  background: #ef4444;
}

.toast-info {
  background: #3b82f6;
}

.toast-close {
  background: none;
  border: none;
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
  margin-left: 1rem;
  padding: 0;
  line-height: 1;
}
```

### 5. Loading Spinner

Create `src/components/LoadingSpinner/index.tsx`:
```typescript
import './LoadingSpinner.css'

export function LoadingSpinner() {
  return (
    <div className="loading-spinner">
      <div className="spinner"></div>
    </div>
  )
}
```

Create `src/components/LoadingSpinner/LoadingSpinner.css`:
```css
.loading-spinner {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f4f6;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

### 6. Update Main App with Toast

Update `src/App.tsx`:
```typescript
import { Router } from './router'
import { ToastContainer } from './components/Toast'

function App() {
  return (
    <>
      <Router />
      <ToastContainer />
    </>
  )
}

export default App
```

## Component Exports

Create `src/components/index.ts`:
```typescript
export { Card } from './Card'
export { Button } from './Button'
export { Input } from './Input'
export { ToastContainer } from './Toast'
export { LoadingSpinner } from './LoadingSpinner'
export { PlayerList } from './PlayerList'
```

## Testing

Create tests for each component:

```typescript
// Example: src/components/Card/__tests__/Card.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Card } from '../index'

describe('Card', () => {
  it('renders card rank and suit', () => {
    render(<Card card={{ rank: 'A', suit: 'hearts' }} />)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('♥')).toBeInTheDocument()
  })

  it('calls onClick when selectable', () => {
    const onClick = vi.fn()
    render(<Card card={{ rank: 'K', suit: 'spades' }} selectable onClick={onClick} />)

    const card = screen.getByText('K').parentElement
    fireEvent.click(card!)

    expect(onClick).toHaveBeenCalled()
  })

  it('shows card back when faceDown', () => {
    render(<Card card={{ rank: 'Q', suit: 'diamonds' }} faceDown />)
    expect(screen.queryByText('Q')).not.toBeInTheDocument()
  })
})
```

## Accessibility

All components should:
- Use semantic HTML
- Support keyboard navigation
- Have proper ARIA labels where needed
- Maintain color contrast ratios (WCAG AA)

## Output Files

- `/frontend/src/components/Card/` - Card component
- `/frontend/src/components/Button/` - Button component
- `/frontend/src/components/Input/` - Input component
- `/frontend/src/components/Toast/` - Toast notification component
- `/frontend/src/components/LoadingSpinner/` - Loading spinner component
- `/frontend/src/components/PlayerList/` - Player list component (created in Task 6)
- `/frontend/src/components/index.ts` - Barrel export file

## Next Steps

- Use these components in all pages
- Task 9: Integration and polish

## Notes

- Card component is the most complex with multiple states
- Green pulse animation for playable cards (4s total: 2s fade in, 2s fade out)
- All components use CSS modules or regular CSS (no CSS-in-JS)
- Toast notifications auto-dismiss after 3 seconds
- Components are fully typed with TypeScript
