export default function ReviewNotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mb-8">
          <span className="font-serif text-4xl font-light">
            <span className="text-[#a01b1b]">Seen</span>
            <span className="text-[#c9a87c]">AI</span>
          </span>
          <p className="text-white/30 text-xs font-sans tracking-widest uppercase mt-1">Reviews</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-xl">
          <div className="flex justify-center mb-5">
            <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <h1 className="font-serif text-2xl text-white mb-2 font-light">
            This link is not active
          </h1>
          <p className="text-white/40 text-sm font-sans leading-relaxed">
            This review link may have expired or is no longer available.
            Please contact the business for assistance.
          </p>
        </div>
      </div>
    </main>
  )
}
