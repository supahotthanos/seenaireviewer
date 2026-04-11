import { ReactNode } from 'react'

interface GlassCardProps {
  children: ReactNode
  className?: string
  padding?: 'sm' | 'md' | 'lg'
}

const paddingMap = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export function GlassCard({ children, className = '', padding = 'md' }: GlassCardProps) {
  return (
    <div
      className={`
        bg-white/5
        backdrop-blur-xl
        border border-white/10
        rounded-2xl
        shadow-xl shadow-black/20
        ${paddingMap[padding]}
        ${className}
      `}
    >
      {children}
    </div>
  )
}
