export default function ReviewPageLoading() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand header skeleton */}
        <div className="text-center mb-8">
          <div className="h-10 w-48 mx-auto rounded-lg bg-white/5 animate-pulse mb-2" />
          <div className="h-4 w-64 mx-auto rounded bg-white/5 animate-pulse" />
        </div>

        {/* Card skeleton */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
          <div className="text-center">
            <div className="h-7 w-48 mx-auto rounded bg-white/5 animate-pulse mb-2" />
            <div className="h-4 w-56 mx-auto rounded bg-white/5 animate-pulse mb-8" />

            {/* Stars skeleton */}
            <div className="flex justify-center gap-3 mb-6">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-12 h-12 rounded-full bg-white/5 animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
