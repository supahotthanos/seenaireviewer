import { Suspense } from 'react'
import AdminDashboard from './AdminDashboard'

export const metadata = {
  title: 'Admin — LovMedSpa Reviews',
  robots: { index: false, follow: false },
}

export default function AdminPage() {
  return (
    <main className="min-h-screen px-4 py-8 sm:py-12">
      <div className="max-w-6xl mx-auto">
        <Suspense fallback={<div className="text-white/60">Loading…</div>}>
          <AdminDashboard />
        </Suspense>
      </div>
    </main>
  )
}
