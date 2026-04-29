export default function ReviewNotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mb-8">
          <span className="font-serif text-4xl font-light">
            <span className="text-[#b4caff]">Seen</span>
            <span className="text-[#b4caff]">AI</span>
          </span>
          <p className="text-[#b4caff]/70 text-xs font-sans tracking-widest uppercase mt-1">Reviews</p>
        </div>

        <div className="bg-[color:var(--surface)] backdrop-blur-xl border border-[color:var(--border)] rounded-2xl p-8 shadow-xl shadow-[color:var(--shadow)]">
          <div className="flex justify-center mb-5">
            <div className="w-14 h-14 rounded-full bg-[color:var(--surface)] border border-[color:var(--border)] flex items-center justify-center">
              <svg className="w-6 h-6 text-[color:var(--text-subtle)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <h1 className="font-serif text-2xl text-[color:var(--text)] mb-2 font-light">
            This link is not active
          </h1>
          <p className="text-[color:var(--text-muted)] text-sm font-sans leading-relaxed">
            This review link may have expired or is no longer available.
            Please contact the business for assistance.
          </p>
        </div>
      </div>
    </main>
  )
}
