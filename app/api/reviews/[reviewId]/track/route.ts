import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PATCH(
  request: NextRequest,
  { params }: { params: { reviewId: string } }
) {
  const { reviewId } = params

  if (!reviewId || !UUID_RE.test(reviewId)) {
    return NextResponse.json({ error: 'Invalid review id' }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const updates: Record<string, boolean> = {}
  if (body.copied_to_clipboard === true) updates.copied_to_clipboard = true
  if (body.redirected_to_google === true) updates.redirected_to_google = true

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }

  const { error } = await supabaseServer
    .from('reviews')
    .update(updates)
    .eq('id', reviewId)

  if (error) {
    console.error('[reviews/track] Update error:', error.message)
    return NextResponse.json({ error: 'Failed to track' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
