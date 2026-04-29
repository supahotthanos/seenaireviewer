import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { supabaseServer } from '@/lib/supabase-server'
import { verifyAdminSecret } from '@/lib/admin-auth'
import { createClientSchema } from '@/lib/validation'

// Partial version of createClientSchema for PATCH — every field becomes
// optional, but the individual field rules (email format, hex color,
// URL format, min/max) are still enforced when provided. Prevents admins
// from writing invalid values like daily_ai_limit: "abc" or services: [].
const updateClientSchema = createClientSchema.partial().omit({ slug: true })

export async function GET(request: NextRequest) {
  if (!verifyAdminSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: clients, error } = await supabaseServer
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/clients] GET error:', error.message)
    return NextResponse.json({ error: 'Failed to list clients' }, { status: 500 })
  }

  // Get review counts per client. Also surface the conversion funnel:
  // how many reviews were copied + how many made it to Google's review
  // dialog. This is what the admin actually cares about (is the funnel
  // converting, not just generating).
  const { data: reviewCounts } = await supabaseServer
    .from('reviews')
    .select('client_id, review_type, copied_to_clipboard, redirected_to_google')

  type ClientStats = {
    positive: number
    negative: number
    total: number
    copied: number
    sent_to_google: number
  }
  const empty = (): ClientStats => ({
    positive: 0,
    negative: 0,
    total: 0,
    copied: 0,
    sent_to_google: 0,
  })
  const stats: Record<string, ClientStats> = {}
  for (const r of reviewCounts || []) {
    if (!stats[r.client_id]) stats[r.client_id] = empty()
    const s = stats[r.client_id]
    s.total++
    if (r.review_type === 'positive') s.positive++
    else s.negative++
    if (r.copied_to_clipboard) s.copied++
    if (r.redirected_to_google) s.sent_to_google++
  }

  const enriched = (clients || []).map((c) => ({
    ...c,
    stats: stats[c.id] || empty(),
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
      google_review_url: data.google_review_url || null,
      notification_email: emails.join(', '),
      brand_color_primary: data.brand_color_primary,
      brand_color_secondary: data.brand_color_secondary,
      logo_url: data.logo_url || null,
      custom_domain: data.custom_domain || null,
      services: data.services,
      team_members: data.team_members,
      aliases: data.aliases ?? [],
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
    console.error('[admin/clients] POST error:', error.message)
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })
  }

  revalidateTag('clients')

  return NextResponse.json({ client: created }, { status: 201 })
}

// ────────────────────────────────────────────────────────────
// PATCH — Update an existing client (any field)
// ────────────────────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  if (!verifyAdminSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { id?: string; updates?: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { id, updates } = body
  if (!id || !updates || typeof updates !== 'object') {
    return NextResponse.json({ error: 'id and updates required' }, { status: 400 })
  }

  // Validate the update payload with the partial schema so individual
  // field rules are enforced (email format, hex color, URL format, array
  // length). Unknown fields are silently dropped by Zod.
  const parsed = updateClientSchema.safeParse(updates)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  // Normalize empty-string optional URLs to null so the DB stores null, not "".
  const cleanUpdates: Record<string, unknown> = { ...parsed.data }
  if (cleanUpdates.logo_url === '') cleanUpdates.logo_url = null
  if (cleanUpdates.google_review_url === '') cleanUpdates.google_review_url = null
  if (cleanUpdates.custom_domain === '') cleanUpdates.custom_domain = null

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
    // Never leak Supabase's raw error message (can expose column names,
    // constraint names, etc.). Log server-side and return a generic msg.
    console.error('[admin/clients] PATCH error:', error.message)
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 })
  }

  // Invalidate the cached public funnel page so admin edits surface
  // immediately instead of after the 60s TTL expires.
  revalidateTag('clients')

  return NextResponse.json({ client: updated })
}
