#!/usr/bin/env node
// Preflight check — run before `npm run build` or before deploying.
//   npm run doctor
//
// Loads .env.local (if present) and reports missing / placeholder env vars.

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(process.cwd())
const ENV_PATH = resolve(ROOT, '.env.local')

if (existsSync(ENV_PATH)) {
  const raw = readFileSync(ENV_PATH, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
} else {
  console.log('ℹ  No .env.local found — checking environment only.')
}

const PLACEHOLDER_ADMIN = 'change-me-to-a-long-random-string-32chars-min'
const PLACEHOLDER_URL = 'https://your-project-id.supabase.co'

const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
  'RESEND_API_KEY',
  'NEXT_PUBLIC_APP_URL',
  'ADMIN_SECRET',
]
const OPTIONAL = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'RESEND_FROM_EMAIL', 'ANTHROPIC_MODEL', 'MAX_AI_REVIEWS_PER_MONTH']

let fails = 0
const row = (status, key, msg) => console.log(`  ${status}  ${key.padEnd(32)} ${msg}`)

console.log('\n  SeenAI Reviews — preflight check\n')

for (const key of REQUIRED) {
  const v = process.env[key]
  if (!v) { row('✗', key, 'MISSING'); fails++; continue }
  if (key === 'ADMIN_SECRET' && v === PLACEHOLDER_ADMIN) { row('✗', key, 'still the placeholder — replace it'); fails++; continue }
  if (key === 'ADMIN_SECRET' && v.length < 24) { row('✗', key, `only ${v.length} chars — needs 24+`); fails++; continue }
  if (key === 'NEXT_PUBLIC_SUPABASE_URL' && v === PLACEHOLDER_URL) { row('✗', key, 'still the placeholder'); fails++; continue }
  row('✓', key, 'ok')
}

for (const key of OPTIONAL) {
  const v = process.env[key]
  row(v ? '✓' : '·', key, v ? 'ok' : 'not set (optional)')
}

console.log('')
if (fails === 0) {
  console.log('  All required env vars look good. Ready to ship.\n')
  process.exit(0)
} else {
  console.log(`  ${fails} problem(s) — fix above, then re-run.\n`)
  console.log('  Tip: copy .env.local.example to .env.local and fill in values.\n')
  process.exit(1)
}
