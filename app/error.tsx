'use client'

// Root-level error boundary — catches anything the nested boundaries miss.
// Applies the safe fallback background explicitly so a broken render never
// leaves the customer on pure black.
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body className="min-h-screen bg-[#f5f1ec] dark:bg-[#0a0a0f] text-black dark:text-white">
        <main className="min-h-screen flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md text-center">
            <h1 className="font-serif text-2xl font-light mb-2">Something went wrong</h1>
            <p className="text-black/60 dark:text-white/60 text-sm font-sans mb-6">
              Please try again in a moment.
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
      </body>
    </html>
  )
}
