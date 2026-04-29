// Visible loading state during the Supabase client fetch. Uses Tailwind
// dark: utilities (not CSS variables) so it renders correctly even before
// our theme stylesheet fully paints — which is the first paint window on
// a cold QR-scan navigation where "black screen" was happening.
export default function ReviewPageLoading() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#f5f1ec] dark:bg-[#0a0a0f]"
    >
      <div className="w-full max-w-md text-center">
        <div className="inline-block mb-6">
          <div className="w-14 h-14 rounded-full border-4 border-black/10 dark:border-white/10 border-t-[#c9a87c] animate-spin" />
        </div>
        <p className="text-black/60 dark:text-white/70 text-sm font-sans tracking-widest uppercase">
          Loading
        </p>
      </div>
    </main>
  )
}
