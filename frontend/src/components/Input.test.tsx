import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom'
import { Input } from './Input'

describe('Input', () => {
  it('renders with placeholder', () => {
    render(<Input placeholder="Enter name" value="" onChange={() => {}} />)
    expect(screen.getByPlaceholderText('Enter name')).toBeInTheDocument()
  })

  it('calls onChange when text is typed', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(<Input value="" onChange={handleChange} />)

    const input = screen.getByRole('textbox')
    await user.type(input, 'test')

    expect(handleChange).toHaveBeenCalled()
  })

  it('displays the value prop', () => {
    render(<Input value="Alice" onChange={() => {}} />)
    expect(screen.getByRole('textbox')).toHaveValue('Alice')
  })

  it('is disabled when disabled prop is true', () => {
    render(<Input value="" onChange={() => {}} disabled />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('applies error styling when error is true', () => {
    render(<Input value="" onChange={() => {}} error />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveClass('border-red-500')
  })

  it('respects maxLength prop', () => {
    render(<Input value="" maxLength={5} onChange={() => {}} />)

    const input = screen.getByRole('textbox')

    // maxLength attribute should be set on the input element
    expect(input).toHaveAttribute('maxLength', '5')
  })

  it('calls onKeyPress handler', async () => {
    const user = userEvent.setup()
    const handleKeyPress = vi.fn()

    render(<Input value="" onKeyPress={handleKeyPress} onChange={() => {}} />)

    const input = screen.getByRole('textbox')
    await user.type(input, 'a')

    expect(handleKeyPress).toHaveBeenCalled()
  })

  it('calls onBlur handler when focus is lost', async () => {
    const user = userEvent.setup()
    const handleBlur = vi.fn()

    render(<Input value="" onBlur={handleBlur} onChange={() => {}} />)

    const input = screen.getByRole('textbox')
    await user.click(input)
    await user.tab()

    expect(handleBlur).toHaveBeenCalled()
  })

  it('accepts text input', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<Input value="" onChange={handleChange} />)
    const input = screen.getByRole('textbox')
    await user.type(input, 'Hello')
    expect(handleChange).toHaveBeenCalled()
  })
})
