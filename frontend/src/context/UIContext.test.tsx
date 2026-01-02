import { render, screen, renderHook, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom'
import { UIProvider, useUI } from './UIContext'

describe('UIContext', () => {
  function TestComponent() {
    const { isLoading, setIsLoading, showToast, toasts } = useUI()
    return (
      <div>
        <p data-testid="loading">{isLoading ? 'Loading' : 'Not Loading'}</p>
        <button onClick={() => setIsLoading(true)}>Start Loading</button>
        <button onClick={() => setIsLoading(false)}>Stop Loading</button>
        <button onClick={() => showToast('Test message', 'success')}>
          Show Toast
        </button>
        {/* Render toasts so we can test them */}
        <div data-testid="toasts">
          {toasts.map((toast) => (
            <div key={toast.id}>{toast.message}</div>
          ))}
        </div>
      </div>
    )
  }

  it('provides initial loading state', () => {
    render(
      <UIProvider>
        <TestComponent />
      </UIProvider>
    )

    expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
  })

  it('updates loading state', async () => {
    const user = userEvent.setup()

    render(
      <UIProvider>
        <TestComponent />
      </UIProvider>
    )

    await user.click(screen.getByText('Start Loading'))
    expect(screen.getByTestId('loading')).toHaveTextContent('Loading')

    await user.click(screen.getByText('Stop Loading'))
    expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
  })

  it('shows toast message', async () => {
    const user = userEvent.setup()

    render(
      <UIProvider>
        <TestComponent />
      </UIProvider>
    )

    await user.click(screen.getByText('Show Toast'))

    await waitFor(() => {
      expect(screen.getByText('Test message')).toBeInTheDocument()
    })
  })

  it('auto-removes toast after duration', async () => {
    vi.useFakeTimers()

    render(
      <UIProvider>
        <TestComponent />
      </UIProvider>
    )

    // Manually call showToast through the context
    const showToastButton = screen.getByText('Show Toast')

    // Use act to wrap the click since it causes state updates
    await act(async () => {
      showToastButton.click()
    })

    expect(screen.getByText('Test message')).toBeInTheDocument()

    // Fast-forward time by 3 seconds (default duration)
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    expect(screen.queryByText('Test message')).not.toBeInTheDocument()

    vi.useRealTimers()
  })

  it('throws error when useUI is used outside provider', () => {
    // Suppress console.error for this test
    const originalError = console.error
    console.error = vi.fn()

    expect(() => {
      renderHook(() => useUI())
    }).toThrow('useUI must be used within UIProvider')

    console.error = originalError
  })
})
