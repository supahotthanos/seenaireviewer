'use client'

import { useEffect, useState } from 'react'

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'warning'
  /** Auto-dismiss after N ms. Ignored when `sticky` is true. */
  duration?: number
  /** When true, never auto-dismiss; show a close (×) button. */
  sticky?: boolean
  /**
   * Optional pixel offset from the bottom edge. Lets a parent stack
   * multiple sticky toasts vertically without them overlapping.
   */
  offsetBottom?: number
  onDismiss: () => void
}

export function Toast({
  message,
  type = 'success',
  duration = 3000,
  sticky = false,
  offsetBottom,
  onDismiss,
}: ToastProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (sticky) return
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 300)
    }, duration)
    return () => clearTimeout(timer)
  }, [duration, sticky, onDismiss])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onDismiss, 300)
  }

  return (
    <div
      className={`
        fixed left-1/2 -translate-x-1/2 z-50
        flex items-center gap-3
        px-5 py-3
        rounded-xl
        shadow-xl shadow-[color:var(--shadow)]
        backdrop-blur-xl
        border
        font-sans text-sm font-medium
        transition-all duration-300
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
        ${
          type === 'success'
            ? 'bg-[#c9a87c]/15 border-[#c9a87c]/40 text-[#7a5c2e] dark:text-[#c9a87c]'
            : type === 'warning'
            ? 'bg-amber-300/15 border-amber-300/50 text-amber-800 dark:text-amber-200'
            : 'bg-red-500/15 border-red-500/40 text-red-700 dark:text-red-400'
        }
      `}
      style={{ bottom: `${offsetBottom ?? 24}px`, maxWidth: 'calc(100vw - 32px)' }}
      role="alert"
      aria-live={sticky ? 'assertive' : 'polite'}
    >
      {type === 'success' ? (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : type === 'warning' ? (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      ) : (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      <span className="flex-1">{message}</span>
      {sticky && (
        <button
          type="button"
          onClick={handleClose}
          aria-label="Dismiss"
          className="ml-1 -mr-1 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
