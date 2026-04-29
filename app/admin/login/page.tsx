'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassInput } from '@/components/ui/GlassInput'
import { GlassButton } from '@/components/ui/GlassButton'

export default function AdminLoginPage() {
  const [secret, setSecret] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Invalid secret')
      }
      // Hard navigate so the middleware sees the fresh cookie on the next request
      window.location.href = '/admin'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-serif text-4xl font-light mb-1">
            <span className="text-[#b4caff]">Seen</span>
            <span className="text-[#b4caff]">AI</span>
          </h1>
          <p className="text-[#b4caff]/80 text-xs font-sans tracking-widest uppercase">
            Admin
          </p>
        </div>

        <GlassCard>
          <form onSubmit={handleSubmit} className="space-y-4">
            <GlassInput
              label="Password"
              type="password"
              placeholder="Enter password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              autoFocus
              autoComplete="current-password"
              error={error || undefined}
            />

            <GlassButton
              type="submit"
              variant="admin"
              loading={loading}
              fullWidth
              disabled={!secret.trim()}
            >
              Sign in
            </GlassButton>
          </form>
        </GlassCard>

        <p className="text-center text-white/40 text-xs font-sans mt-4">
          Session stays active for 30 days on this device.
        </p>
      </div>
    </main>
  )
}
