import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { supabaseServer } from '@/lib/supabase-server'
import { verifyAdminSecret } from '@/lib/admin-auth'

function generateShortCode(prefix: string): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return `${prefix}-${result}`
}

export async function POST(request: NextRequest) {
  if (!verifyAdminSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { client_id?: string; label?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { client_id, label } = body

  if (!client_id) {
    return NextResponse.json({ error: 'client_id required' }, { status: 400 })
  }

  // Fetch client
  const { data: client, error: clientError } = await supabaseServer
    .from('clients')
    .select('id, slug')
    .eq('id', client_id)
    .single()

  if (clientError || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  // Generate unique short code
  const slugPrefix = client.slug.replace('lovmedspa-', 'lms-').slice(0, 8)
  const shortCode = generateShortCode(slugPrefix)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const qrUrl = `${appUrl}/q/${shortCode}`

  // Generate QR code as data URL (so the admin page can display + download)
  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    width: 1024,
    margin: 2,
    color: { dark: '#0a0a0f', light: '#ffffff' },
    errorCorrectionLevel: 'H',
  })

  // Insert tracking row
  const { error: insertError } = await supabaseServer.from('qr_codes').insert({
    client_id,
    short_code: shortCode,
    label: (label || 'New QR Code').slice(0, 100),
  })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({
    short_code: shortCode,
    qr_url: qrUrl,
    qr_data_url: qrDataUrl,
    label: label || 'New QR Code',
  })
}

// List existing QR codes for a client
export async function GET(request: NextRequest) {
  if (!verifyAdminSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const clientId = request.nextUrl.searchParams.get('client_id')

  let query = supabaseServer
    .from('qr_codes')
    .select('*')
    .order('created_at', { ascending: false })

  if (clientId) {
    query = query.eq('client_id', clientId)
  }

  const { data: qrCodes, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ qr_codes: qrCodes })
}
