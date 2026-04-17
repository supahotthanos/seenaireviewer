import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Server-side Supabase client — uses the service-role key.
// NEVER import this in client components or expose to the browser.
//
// The client is created lazily so that /api/health can still load and
// report "MISSING env var" instead of crashing the entire server at
// import time.

let client: SupabaseClient | null = null

function buildClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Missing Supabase server env vars — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
    )
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Proxy that builds the real client on first use.
export const supabaseServer = new Proxy({} as SupabaseClient, {
  get(_target, prop: string | symbol) {
    if (!client) client = buildClient()
    const value = (client as unknown as Record<string | symbol, unknown>)[prop]
    return typeof value === 'function' ? (value as Function).bind(client) : value
  },
})
