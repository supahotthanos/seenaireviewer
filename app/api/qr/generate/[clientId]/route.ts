import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { supabaseServer } from '@/lib/supabase-server'

// Generate a simple alphanumeric short code without nanoid
function generateShortCode(prefix: string): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return `${prefix}-${result}`
}

export async function GET(
  request: NextRequest,
  { params }: { params: { clientId: string } }
) {
  try {
    // 1. Verify admin auth via Supabase JWT
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // 2. Fetch client
    const { data: client, error: clientError } = await supabaseServer
      .from('clients')
      .select('id, slug')
      .eq('id', params.clientId)
      .single()

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // 3. Generate unique short code
    const slugPrefix = client.slug.replace('lovmedspa-', 'lms-').slice(0, 8)
    const shortCode = generateShortCode(slugPrefix)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const qrUrl = `${appUrl}/q/${shortCode}`

    // 4. Generate QR code PNG buffer
    const qrBuffer = await QRCode.toBuffer(qrUrl, {
      width: 1024,
      margin: 2,
      color: {
        dark: '#0a0a0f',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })

    // 5. Save PNG to Supabase Storage
    const storagePath = `${params.clientId}/${shortCode}.png`
    await supabaseServer.storage
      .from('qr-codes')
      .upload(storagePath, qrBuffer, {
        contentType: 'image/png',
        upsert: false,
      })

    // 6. Get label from query param
    const label = request.nextUrl.searchParams.get('label') || 'New QR Code'

    // 7. Insert tracking row
    await supabaseServer.from('qr_codes').insert({
      client_id: params.clientId,
      short_code: shortCode,
      label: label.slice(0, 100),
    })

    // 8. Return PNG
    return new NextResponse(new Uint8Array(qrBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${shortCode}.png"`,
        'X-Short-Code': shortCode,
        'X-QR-URL': qrUrl,
      },
    })
  } catch (error) {
    console.error('[qr-generate] Error:', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
