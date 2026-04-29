import { NextRequest, NextResponse } from 'next/server'
import {
  ADMIN_COOKIE_NAME,
  ADMIN_COOKIE_MAX_AGE,
  getAdminSecret,
  secretMatches,
} from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  const expected = getAdminSecret()
  if (!expected) {
    return NextResponse.json(
      { error: 'Admin not configured on this server' },
      { status: 500 }
    )
  }

  let body: { secret?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (!body.secret || !secretMatches(body.secret)) {
    // Small artificial delay to make brute-force noticeably painful on top
    // of the Vercel per-IP rate limit.
    await new Promise((r) => setTimeout(r, 400))
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE_NAME, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: ADMIN_COOKIE_MAX_AGE,
  })
  return res
}
