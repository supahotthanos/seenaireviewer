'use client'

import { useState } from 'react'

interface StarRatingProps {
  value: number
  onChange: (rating: number) => void
  size?: 'sm' | 'md' | 'lg'
  readonly?: boolean
}

const sizeMap = {
  sm: 'w-8 h-8 text-2xl',
  md: 'w-11 h-11 text-4xl',
  lg: 'w-14 h-14 text-5xl',
}

export function StarRating({ value, onChange, size = 'md', readonly = false }: StarRatingProps) {
  const [hovered, setHovered] = useState(0)

  const activeRating = hovered || value

  return (
    <div className="flex gap-1" role="group" aria-label="Star rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => !readonly && onChange(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(0)}
          aria-label={`${star} star${star !== 1 ? 's' : ''}`}
          aria-pressed={value === star}
          className={`
            ${sizeMap[size]}
            flex items-center justify-center
            transition-all duration-150
            focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a87c] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent
            ${!readonly ? 'cursor-pointer hover:scale-110 active:scale-95' : 'cursor-default'}
            ${readonly ? '' : ''}
          `}
        >
          <span
            className={`
              select-none
              transition-colors duration-150
              ${star <= activeRating ? 'text-[#c9a87c] drop-shadow-[0_0_6px_rgba(201,168,124,0.6)]' : 'text-[color:var(--text-subtle)] opacity-50'}
            `}
          >
            ★
          </span>
        </button>
      ))}
    </div>
  )
}
