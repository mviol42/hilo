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
  const baseClasses = 'w-full px-4 py-3 text-base border-2 rounded-lg transition-colors duration-200'
  const errorClasses = error
    ? 'border-red-500 focus:border-red-600'
    : 'border-gray-300 focus:border-blue-500'
  const disabledClasses = disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'

  const className = [baseClasses, errorClasses, disabledClasses, 'focus:outline-none']
    .filter(Boolean)
    .join(' ')

  return (
    <input
      type={type}
      className={className}
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
