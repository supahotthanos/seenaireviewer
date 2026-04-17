import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { verifyAdminSecret } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  if (!verifyAdminSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const clientId = request.nextUrl.searchParams.get('client_id')
  const limit = Number(request.nextUrl.searchParams.get('limit') || '50')

  let query = supabaseServer
    .from('reviews')
    .select('id, client_id, customer_name, customer_phone, customer_email, star_rating, service_selected, team_member_selected, original_comments, generated_review, review_type, copied_to_clipboard, redirected_to_google, source, created_at')
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, 200))

  if (clientId) {
    query = query.eq('client_id', clientId)
  }

  const { data: reviews, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ reviews })
}
