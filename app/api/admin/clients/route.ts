import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { verifyAdminSecret } from '@/lib/admin-auth'
import { createClientSchema } from '@/lib/validation'

export async function GET(request: NextRequest) {
  if (!verifyAdminSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: clients, error } = await supabaseServer
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Get review counts per client
  const { data: reviewCounts } = await supabaseServer
    .from('reviews')
    .select('client_id, review_type')

  const stats: Record<string, { positive: number; negative: number; total: number }> = {}
  for (const r of reviewCounts || []) {
    if (!stats[r.client_id]) stats[r.client_id] = { positive: 0, negative: 0, total: 0 }
    stats[r.client_id].total++
    if (r.review_type === 'positive') stats[r.client_id].positive++
    else stats[r.client_id].negative++
  }

  const enriched = (clients || []).map((c) => ({
    ...c,
    stats: stats[c.id] || { positive: 0, negative: 0, total: 0 },
  }))

  return NextResponse.json({ clients: enriched })
}

// ────────────────────────────────────────────────────────────
// POST — Create a new client
// ────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  if (!verifyAdminSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createClientSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const data = parsed.data

  // Zod already validated each comma-separated email; just normalize.
  const emails = data.notification_email
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)

  const { data: created, error } = await supabaseServer
    .from('clients')
    .insert({
      slug: data.slug,
      business_name: data.business_name,
      location_address: data.location_address || null,
      location_city: data.location_city,
      google_place_id: data.google_place_id,
      notification_email: emails.join(', '),
      brand_color_primary: data.brand_color_primary,
      brand_color_secondary: data.brand_color_secondary,
      logo_url: data.logo_url || null,
      services: data.services,
      team_members: data.team_members,
      daily_ai_limit: data.daily_ai_limit,
      is_active: data.is_active,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: `Slug "${data.slug}" is already taken — pick a different one` },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ client: created }, { status: 201 })
}

// ────────────────────────────────────────────────────────────
// PATCH — Update an existing client (any field)
// ────────────────────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  if (!verifyAdminSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { id?: string; updates?: Partial<Record<string, unknown>> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { id, updates } = body
  if (!id || !updates || typeof updates !== 'object') {
    return NextResponse.json({ error: 'id and updates required' }, { status: 400 })
  }

  // Whitelist allowed fields
  const allowedFields = [
    'business_name',
    'location_address',
    'location_city',
    'google_place_id',
    'notification_email',
    'brand_color_primary',
    'brand_color_secondary',
    'logo_url',
    'services',
    'team_members',
    'daily_ai_limit',
    'is_active',
  ]

  const cleanUpdates: Record<string, unknown> = {}
  for (const key of allowedFields) {
    if (key in updates) cleanUpdates[key] = updates[key]
  }

  if (Object.keys(cleanUpdates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data: updated, error } = await supabaseServer
    .from('clients')
    .update(cleanUpdates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ client: updated })
}
