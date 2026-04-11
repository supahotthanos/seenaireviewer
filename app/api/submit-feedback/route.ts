import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { submitFeedbackSchema } from '@/lib/validation'
import { supabaseServer } from '@/lib/supabase-server'
import { getFeedbackRateLimiter, checkRateLimit } from '@/lib/rate-limit'
import { sendNegativeFeedbackAlert } from '@/lib/email'

function sanitize(str: string, maxLen = 2000): string {
  return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen)
}

export async function POST(request: NextRequest) {
  try {
    // 1. Hash the IP
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown'
    const ipHash = createHash('sha256').update(ip).digest('hex')

    // 2. Rate limit check
    const limiter = getFeedbackRateLimiter()
    const { allowed, remaining, reset } = await checkRateLimit(limiter, `ip:${ipHash}`)

    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again later.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': String(remaining),
            'X-RateLimit-Reset': String(reset),
          },
        }
      )
    }

    // 3. Parse and validate
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = submitFeedbackSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { client_id, customer_name, contact, feedback_text, star_rating, source } = parsed.data

    // 4. Fetch client
    const { data: client, error: clientError } = await supabaseServer
      .from('clients')
      .select('*')
      .eq('id', client_id)
      .eq('is_active', true)
      .single()

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // 5. Determine if contact is phone or email
    const isEmail = contact && contact.includes('@')
    const customerEmail = isEmail ? sanitize(contact, 200) : null
    const customerPhone = !isEmail && contact ? sanitize(contact, 200) : null

    // 6. Insert review row
    const { data: reviewRow, error: insertError } = await supabaseServer
      .from('reviews')
      .insert({
        client_id,
        customer_name: sanitize(customer_name, 100),
        customer_phone: customerPhone,
        customer_email: customerEmail,
        star_rating,
        original_comments: sanitize(feedback_text, 2000),
        review_type: 'negative',
        source: source || 'web',
        ip_hash: ipHash,
        user_agent: request.headers.get('user-agent')?.slice(0, 500) || null,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[submit-feedback] Insert error:', insertError.message)
      return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
    }

    // 7. Send email alert (non-blocking — don't fail the request if email fails)
    try {
      await sendNegativeFeedbackAlert(client, {
        ...reviewRow,
        customer_name: sanitize(customer_name, 100),
        star_rating,
        original_comments: sanitize(feedback_text, 2000),
        contact: contact ? sanitize(contact, 200) : undefined,
        source: source || 'web',
      })
    } catch (emailError) {
      console.error('[submit-feedback] Email error:', emailError instanceof Error ? emailError.message : 'unknown')
    }

    return NextResponse.json({ success: true, review_id: reviewRow?.id })
  } catch (error) {
    console.error('[submit-feedback] Unhandled error:', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
