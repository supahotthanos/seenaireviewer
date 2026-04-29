'use client'

// Catches unhandled render errors on the public funnel. Without this, a
// JS error during hydration leaves the customer on a blank dark page with
// no explanation. With it, they get a human-readable message and a retry.
export default function ReviewPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#f5f1ec] dark:bg-[#0a0a0f]">
      <div className="w-full max-w-md text-center">
        <div className="mb-6">
          <div className="mx-auto w-14 h-14 rounded-full border border-black/10 dark:border-white/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-black/40 dark:text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>
        <h1 className="font-serif text-2xl text-black/80 dark:text-white/80 font-light mb-2">
          Something went wrong
        </h1>
        <p className="text-black/60 dark:text-white/60 text-sm font-sans mb-6">
          We couldn&apos;t load this page. Please try again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center justify-center min-h-[44px] px-6 py-3 rounded-xl font-sans font-medium text-[15px] bg-[#c9a87c] hover:bg-[#e0c99a] text-[#0a0a0f] transition-all"
        >
          Try again
        </button>
      </div>
    </main>
  )
}
