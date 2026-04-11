import { forwardRef, SelectHTMLAttributes } from 'react'

interface GlassSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  placeholder?: string
  options: string[]
}

export const GlassSelect = forwardRef<HTMLSelectElement, GlassSelectProps>(
  ({ label, error, placeholder, options, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-white/70 mb-1.5 font-sans">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={`
              w-full
              appearance-none
              bg-white/5
              border ${error ? 'border-red-400/60' : 'border-white/10'}
              rounded-xl
              px-4 py-3
              pr-10
              text-white
              text-[16px]
              font-sans
              focus:outline-none
              focus:border-[#c9a87c]/60
              focus:bg-white/8
              focus:ring-1 focus:ring-[#c9a87c]/30
              transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
              ${!props.value ? 'text-white/30' : 'text-white'}
              ${className}
            `}
            {...props}
          >
            {placeholder && (
              <option value="" disabled className="bg-[#1a1a2e] text-white/50">
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt} value={opt} className="bg-[#1a1a2e] text-white">
                {opt}
              </option>
            ))}
          </select>
          {/* Custom chevron */}
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
            <svg
              className="w-4 h-4 text-white/40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        {error && (
          <p className="mt-1.5 text-sm text-red-400 font-sans">{error}</p>
        )}
      </div>
    )
  }
)

GlassSelect.displayName = 'GlassSelect'
