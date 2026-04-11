'use client'

import { createBrowserClient } from '@supabase/ssr'

// Browser-side Supabase client — uses anon key, scoped by RLS
// Safe to use in client components
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Singleton instance for client components
let client: ReturnType<typeof createSupabaseBrowserClient> | null = null

export function getSupabaseBrowser() {
  if (!client) {
    client = createSupabaseBrowserClient()
  }
  return client
}
