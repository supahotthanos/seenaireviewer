interface StepIndicatorProps {
  steps: number
  current: number
}

export function StepIndicator({ steps, current }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2" role="progressbar" aria-valuenow={current} aria-valuemin={1} aria-valuemax={steps}>
      {Array.from({ length: steps }, (_, i) => {
        const stepNum = i + 1
        const isActive = stepNum === current
        const isCompleted = stepNum < current

        return (
          <div
            key={i}
            className={`
              rounded-full transition-all duration-300
              ${isActive ? 'w-6 h-2 bg-[#c9a87c]' : isCompleted ? 'w-2 h-2 bg-[#c9a87c]/60' : 'w-2 h-2 bg-[color:var(--border-strong)]'}
            `}
          />
        )
      })}
    </div>
  )
}
