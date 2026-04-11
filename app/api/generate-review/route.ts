import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { generateReviewSchema } from '@/lib/validation'
import { generateAEOReview } from '@/lib/anthropic'
import { supabaseServer } from '@/lib/supabase-server'
import { getAIRateLimiter, checkRateLimit } from '@/lib/rate-limit'

// Sanitize string — strip HTML tags and trim
function sanitize(str: string, maxLen = 500): string {
  return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen)
}

export async function POST(request: NextRequest) {
  try {
    // 1. Hash the IP address
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown'
    const ipHash = createHash('sha256').update(ip).digest('hex')

    // 2. Rate limit check
    const limiter = getAIRateLimiter()
    const { allowed, remaining, reset } = await checkRateLimit(limiter, `ip:${ipHash}`)

    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': String(remaining),
            'X-RateLimit-Reset': String(reset),
          },
        }
      )
    }

    // 3. Parse and validate request body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = generateReviewSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { client_id, customer_name, service, team_member, comments, star_rating, source, qr_code } =
      parsed.data

    // 4. Honeypot check (already validated by Zod — honeypot max length 0)
    // If we got here, honeypot is empty (valid)

    // 5. Fetch client from Supabase
    const { data: client, error: clientError } = await supabaseServer
      .from('clients')
      .select('*')
      .eq('id', client_id)
      .eq('is_active', true)
      .single()

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // 6. Generate review via Anthropic
    const generatedReview = await generateAEOReview({
      client,
      customerName: sanitize(customer_name, 100),
      service: sanitize(service, 100),
      teamMember: sanitize(team_member, 100),
      comments: comments ? sanitize(comments, 500) : undefined,
    })

    // 7. Insert review row
    const { data: reviewRow, error: insertError } = await supabaseServer
      .from('reviews')
      .insert({
        client_id,
        customer_name: sanitize(customer_name, 100),
        star_rating,
        service_selected: sanitize(service, 100),
        team_member_selected: sanitize(team_member, 100),
        original_comments: comments ? sanitize(comments, 500) : null,
        generated_review: generatedReview,
        review_type: 'positive',
        source: source || 'web',
        ip_hash: ipHash,
        user_agent: request.headers.get('user-agent')?.slice(0, 500) || null,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[generate-review] Insert error:', insertError.message)
      // Still return the review even if DB insert fails
    }

    return NextResponse.json({
      generated_review: generatedReview,
      review_id: reviewRow?.id ?? null,
    })
  } catch (error) {
    console.error('[generate-review] Unhandled error:', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
