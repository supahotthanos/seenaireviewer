import { forwardRef, InputHTMLAttributes } from 'react'

interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-white/70 mb-1.5 font-sans">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`
            w-full
            bg-white/5
            border ${error ? 'border-red-400/60' : 'border-white/10'}
            rounded-xl
            px-4 py-3
            text-white
            text-[16px]
            font-sans
            placeholder:text-white/30
            focus:outline-none
            focus:border-[#c9a87c]/60
            focus:bg-white/8
            focus:ring-1 focus:ring-[#c9a87c]/30
            transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-sm text-red-400 font-sans">{error}</p>
        )}
      </div>
    )
  }
)

GlassInput.displayName = 'GlassInput'
