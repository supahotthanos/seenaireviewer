import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

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
