import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// Edge runtime — cold starts in ~50ms vs ~800ms on Node. The customer's
// first scan of a QR hits this route; every ms of latency here is visible
// as a blank screen on iOS Safari between the camera app and the funnel.
export const runtime = 'edge'

export async function GET(
  _request: NextRequest,
  { params }: { params: { shortCode: string } }
) {
  const { shortCode } = params

  if (!shortCode || shortCode.length > 50) {
    return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'))
  }

  try {
    // 1. Look up QR code + its client
    const { data: qrCode, error } = await supabaseServer
      .from('qr_codes')
      .select('id, client_id, is_active, clients(slug, custom_domain)')
      .eq('short_code', shortCode)
      .single()

    if (error || !qrCode || !qrCode.is_active) {
      // Unknown or inactive QR code — redirect to base URL
      return NextResponse.redirect(
        new URL('/', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
      )
    }

    // 2. Increment scan count (fire and forget — don't await)
    void supabaseServer.rpc('increment_qr_scan', { qr_id: qrCode.id })

    // 3. Build redirect URL
    const clientData = qrCode.clients as unknown as { slug: string; custom_domain: string | null } | { slug: string; custom_domain: string | null }[] | null
    const slug = Array.isArray(clientData) ? clientData[0]?.slug : clientData?.slug
    const customDomain = Array.isArray(clientData) ? clientData[0]?.custom_domain : clientData?.custom_domain

    if (!slug) {
      return NextResponse.redirect(
        new URL('/', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
      )
    }

    let baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    let targetPath = `/${slug}`
    
    if (customDomain) {
      baseUrl = `https://${customDomain}`
      targetPath = `/`
    }

    const redirectUrl = new URL(targetPath, baseUrl)
    redirectUrl.searchParams.set('src', 'qr')
    redirectUrl.searchParams.set('qr', shortCode)

    return NextResponse.redirect(redirectUrl, { status: 302 })
  } catch (error) {
    console.error('[qr-redirect] Error:', error instanceof Error ? error.message : 'unknown')
    return NextResponse.redirect(
      new URL('/', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
    )
  }
}
