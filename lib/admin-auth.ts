import { NextRequest } from 'next/server'
import { timingSafeEqual } from 'crypto'

const PLACEHOLDER = 'change-me-to-a-long-random-string-32chars-min'
const MIN_SECRET_LENGTH = 24

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

export function getAdminSecret(): string | null {
  const expected = process.env.ADMIN_SECRET
  if (!expected) return null
  if (expected === PLACEHOLDER) return null
  if (expected.length < MIN_SECRET_LENGTH) return null
  return expected
}

// Simple secret-based auth for admin endpoints
// Pass the secret via either:
//   - URL param: ?key=SECRET
//   - Header: x-admin-secret: SECRET
export function verifyAdminSecret(request: NextRequest): boolean {
  const expected = getAdminSecret()
  if (!expected) return false

  const fromHeader = request.headers.get('x-admin-secret')
  const fromQuery = request.nextUrl.searchParams.get('key')
  const provided = fromHeader || fromQuery
  if (!provided) return false

  return safeEqual(provided, expected)
}
