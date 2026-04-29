// Root-level loading fallback for any route that doesn't have its own
// loading.tsx. Prevents the brief "black screen" you'd otherwise see if a
// route's server work is still resolving when the user first paints.
export default function RootLoading() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#f5f1ec] dark:bg-[#0a0a0f]">
      <div className="w-14 h-14 rounded-full border-4 border-black/10 dark:border-white/10 border-t-[#c9a87c] animate-spin" />
    </main>
  )
}
