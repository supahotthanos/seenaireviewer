// Central env-var access with clear failure modes.
//
// Every server-side key is checked here. If something is missing or left at
// a placeholder value, you see it immediately — either at startup (via the
// `npm run doctor` script) or by hitting /api/health in a browser.

export type EnvKey =
  | 'NEXT_PUBLIC_SUPABASE_URL'
  | 'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  | 'SUPABASE_SERVICE_ROLE_KEY'
  | 'ANTHROPIC_API_KEY'
  | 'RESEND_API_KEY'
  | 'UPSTASH_REDIS_REST_URL'
  | 'UPSTASH_REDIS_REST_TOKEN'
  | 'NEXT_PUBLIC_APP_URL'
  | 'ADMIN_SECRET'

const PLACEHOLDERS: Partial<Record<EnvKey, string[]>> = {
  ADMIN_SECRET: ['change-me-to-a-long-random-string-32chars-min'],
  NEXT_PUBLIC_SUPABASE_URL: ['https://your-project-id.supabase.co'],
  NEXT_PUBLIC_APP_URL: ['https://reviews.seenai.com'],
}

export interface EnvStatus {
  key: EnvKey
  status: 'ok' | 'missing' | 'placeholder' | 'short'
  required: boolean
  message: string
}

const REQUIRED: EnvKey[] = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
  'RESEND_API_KEY',
  'NEXT_PUBLIC_APP_URL',
  'ADMIN_SECRET',
]

const OPTIONAL: EnvKey[] = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
]

function check(key: EnvKey, required: boolean): EnvStatus {
  const value = process.env[key]
  if (!value) {
    return {
      key,
      status: 'missing',
      required,
      message: required ? 'MISSING — set this in Vercel / .env.local' : 'not set (rate limiting disabled)',
    }
  }
  const placeholders = PLACEHOLDERS[key] || []
  if (placeholders.includes(value)) {
    return { key, status: 'placeholder', required, message: 'still set to the placeholder value — replace it' }
  }
  if (key === 'ADMIN_SECRET' && value.length < 24) {
    return { key, status: 'short', required, message: `ADMIN_SECRET is ${value.length} chars — needs at least 24` }
  }
  return { key, status: 'ok', required, message: 'ok' }
}

export function checkAllEnv(): EnvStatus[] {
  return [
    ...REQUIRED.map((k) => check(k, true)),
    ...OPTIONAL.map((k) => check(k, false)),
  ]
}

export function envSummary(): { ok: boolean; problems: EnvStatus[]; statuses: EnvStatus[] } {
  const statuses = checkAllEnv()
  const problems = statuses.filter((s) => s.required && s.status !== 'ok')
  return { ok: problems.length === 0, problems, statuses }
}
