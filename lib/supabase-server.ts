import { createClient } from '@supabase/supabase-js'

// Server-side Supabase client — uses service role key
// NEVER import this in client components or expose to the browser
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase server environment variables')
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Singleton for use in API routes and server components
export const supabaseServer = createServerClient()
