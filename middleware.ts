import { NextRequest, NextResponse } from 'next/server'

const PLACEHOLDER = 'change-me-to-a-long-random-string-32chars-min'
const MIN_SECRET_LENGTH = 24

// Constant-time compare that runs on the Edge runtime (no Node crypto).
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Gate /admin pages at the edge. API routes under /api/admin enforce their
  // own check via verifyAdminSecret — this just stops the page shell from
  // rendering to unauthenticated browsers.
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const expected = process.env.ADMIN_SECRET
    const valid =
      expected &&
      expected !== PLACEHOLDER &&
      expected.length >= MIN_SECRET_LENGTH
    const provided = request.nextUrl.searchParams.get('key')

    if (!valid || !provided || !safeEqual(provided, expected!)) {
      return new NextResponse('Not found', { status: 404 })
    }
  }

  // Only apply extra checks to API routes
  if (pathname.startsWith('/api/')) {
    // CORS — only allow requests from our own domain
    const origin = request.headers.get('origin')
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Allow same-origin requests (no origin header) and our app URL
    if (origin && origin !== appUrl) {
      return new NextResponse(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  // Custom Domain Whitelabeling rewrite
  const host = request.headers.get('host') || ''
  const appHost = new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').host

  if (
    host &&
    host !== appHost &&
    pathname === '/'
  ) {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      
      if (supabaseUrl && anonKey) {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/clients?custom_domain=eq.${encodeURIComponent(host)}&select=slug&limit=1`,
          {
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
            },
            next: { revalidate: 60 } // cache the domain lookup for 60s
          }
        )
        if (res.ok) {
          const data = await res.json()
          if (data && data.length > 0 && data[0].slug) {
            const rewriteUrl = new URL(`/${data[0].slug}`, request.url)
            rewriteUrl.search = request.nextUrl.search
            
            const rewriteResponse = NextResponse.rewrite(rewriteUrl)
            rewriteResponse.headers.set('X-Frame-Options', 'DENY')
            rewriteResponse.headers.set('X-Content-Type-Options', 'nosniff')
            return rewriteResponse
          }
        }
      }
    } catch (e) {
      console.error('[Middleware] Domain lookup failed', e)
    }
  }

  const response = NextResponse.next()

  // Add security headers to all responses
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')

  return response
}

export const config = {
  matcher: [
    // Run on all routes except static files and _next
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}
