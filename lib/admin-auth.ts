import { NextRequest } from 'next/server'
import { timingSafeEqual } from 'crypto'

const PLACEHOLDER = 'change-me-to-a-long-random-string-32chars-min'
const MIN_SECRET_LENGTH = 8

// Name of the HttpOnly cookie that keeps admins signed in after login.
// HttpOnly + Secure + SameSite=Strict means it can't be read by JS, can't
// travel over HTTP, and can't be used in cross-site requests.
export const ADMIN_COOKIE_NAME = 'seenai_admin_session'
// 30 days — long enough to feel like "stay signed in" but bounded so a
// stolen device eventually loses access.
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 30

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

// Timing-safe check that a provided value matches the configured secret.
// Use this anywhere we receive an admin-secret candidate (login POST,
// cookie value, CLI script header).
export function secretMatches(candidate: string): boolean {
  const expected = getAdminSecret()
  if (!expected || !candidate) return false
  return safeEqual(candidate, expected)
}

// Auth check used by every /api/admin/* route and some server-side
// renders. Accepts EITHER:
//   1. The `seenai_admin_session` cookie (browser flow, set by POST
//      /api/admin/login after the operator signs in)
//   2. The `x-admin-secret` HTTP header (programmatic flow — CLI scripts
//      that shouldn't deal with cookie jars)
//
// Note: we deliberately do NOT accept `?key=` query params anymore. They
// leak into browser history, server logs, and Referer headers.
export function verifyAdminSecret(request: NextRequest): boolean {
  const cookieValue = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  if (cookieValue && secretMatches(cookieValue)) return true

  const headerValue = request.headers.get('x-admin-secret')
  if (headerValue && secretMatches(headerValue)) return true

  return false
}
