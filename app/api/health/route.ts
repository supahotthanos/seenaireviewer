import { NextResponse } from 'next/server'
import { envSummary } from '@/lib/env'
import { supabaseServer } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const env = envSummary()

  // Try a trivial DB query so we surface misconfigured Supabase immediately.
  let db: { ok: boolean; error?: string } = { ok: false }
  try {
    const { error } = await supabaseServer.from('clients').select('id', { head: true, count: 'exact' }).limit(1)
    db = error ? { ok: false, error: error.message } : { ok: true }
  } catch (e) {
    db = { ok: false, error: e instanceof Error ? e.message : 'unknown' }
  }

  const ok = env.ok && db.ok
  return NextResponse.json(
    {
      ok,
      env: env.statuses.map((s) => ({
        key: s.key,
        status: s.status,
        required: s.required,
        message: s.message,
      })),
      database: db,
      hint: ok
        ? 'All systems ready. Open /admin?key=YOUR_ADMIN_SECRET to get started.'
        : 'One or more services are misconfigured. Fix the items above, then reload this page.',
    },
    { status: ok ? 200 : 503 }
  )
}
