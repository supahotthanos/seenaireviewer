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
        bg-[color:var(--surface)]
        backdrop-blur-xl
        border border-[color:var(--border)]
        rounded-2xl
        shadow-xl shadow-[color:var(--shadow)]
        ${paddingMap[padding]}
        ${className}
      `}
    >
      {children}
    </div>
  )
}
