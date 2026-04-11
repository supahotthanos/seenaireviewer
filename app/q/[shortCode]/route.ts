import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

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
      .select('id, client_id, is_active, clients(slug)')
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
    const clientData = qrCode.clients as unknown as { slug: string } | { slug: string }[] | null
    const slug = Array.isArray(clientData) ? clientData[0]?.slug : clientData?.slug

    if (!slug) {
      return NextResponse.redirect(
        new URL('/', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const redirectUrl = new URL(`/${slug}`, appUrl)
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
