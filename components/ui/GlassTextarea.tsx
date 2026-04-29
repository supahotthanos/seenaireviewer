import { forwardRef, TextareaHTMLAttributes } from 'react'

interface GlassTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  maxChars?: number
  currentLength?: number
}

export const GlassTextarea = forwardRef<HTMLTextAreaElement, GlassTextareaProps>(
  ({ label, error, maxChars, currentLength, className = '', ...props }, ref) => {
    const isNearLimit = maxChars && currentLength !== undefined && currentLength > maxChars * 0.85
    const isAtLimit = maxChars && currentLength !== undefined && currentLength >= maxChars

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-[color:var(--text-muted)] mb-1.5 font-sans">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={`
            w-full
            bg-[color:var(--surface)]
            border ${error ? 'border-red-400/60' : 'border-[color:var(--border)]'}
            rounded-xl
            px-4 py-3
            text-[color:var(--text)]
            text-[16px]
            font-sans
            placeholder:text-[color:var(--placeholder)]
            focus:outline-none
            focus:border-[#c9a87c]/60
            focus:bg-[color:var(--surface-hover)]
            focus:ring-1 focus:ring-[#c9a87c]/30
            transition-all duration-200
            resize-none
            disabled:opacity-50 disabled:cursor-not-allowed
            leading-relaxed
            ${className}
          `}
          {...props}
        />
        <div className="flex justify-between items-center mt-1.5">
          {error ? (
            <p className="text-sm text-red-500 dark:text-red-400 font-sans">{error}</p>
          ) : (
            <span />
          )}
          {maxChars !== undefined && currentLength !== undefined && (
            <span
              className={`text-xs font-sans transition-colors ${
                isAtLimit
                  ? 'text-red-500 dark:text-red-400'
                  : isNearLimit
                  ? 'text-yellow-600 dark:text-yellow-400/70'
                  : 'text-[color:var(--text-subtle)]'
              }`}
            >
              {currentLength}/{maxChars}
            </span>
          )}
        </div>
      </div>
    )
  }
)

GlassTextarea.displayName = 'GlassTextarea'
