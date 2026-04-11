import { ButtonHTMLAttributes, ReactNode } from 'react'

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  loading?: boolean
  children: ReactNode
  fullWidth?: boolean
}

const variantMap = {
  primary: `
    bg-[#c9a87c] hover:bg-[#e0c99a]
    text-[#0a0a0f]
    border border-[#c9a87c]/50
    shadow-lg shadow-[#c9a87c]/20
    hover:shadow-[#c9a87c]/40
  `,
  secondary: `
    bg-white/5 hover:bg-white/10
    text-white
    border border-white/15 hover:border-white/25
  `,
  danger: `
    bg-[#a01b1b] hover:bg-[#c02020]
    text-white
    border border-[#a01b1b]/50
    shadow-lg shadow-[#a01b1b]/20
  `,
}

export function GlassButton({
  variant = 'primary',
  loading = false,
  children,
  fullWidth = false,
  className = '',
  disabled,
  ...props
}: GlassButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2
        min-h-[44px] px-6 py-3
        rounded-xl
        font-sans font-medium text-[15px]
        transition-all duration-200
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a87c] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent
        active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
        ${variantMap[variant]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {loading && (
        <svg
          className="w-4 h-4 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  )
}
