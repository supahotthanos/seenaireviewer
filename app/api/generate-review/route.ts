import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { generateReviewSchema } from '@/lib/validation'
import { generateAEOReview } from '@/lib/anthropic'
import { supabaseServer } from '@/lib/supabase-server'
import {
  getAIRateLimiter,
  getAIDailyIpLimiter,
  checkRateLimit,
  checkClientDailyAILimit,
  checkGlobalMonthlyAILimit,
} from '@/lib/rate-limit'

function sanitize(str: string, maxLen = 500): string {
  return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen)
}

export async function POST(request: NextRequest) {
  try {
    // ────────────────────────────────────────
    // 1. Hash the IP
    // ────────────────────────────────────────
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown'
    const ipHash = createHash('sha256').update(ip).digest('hex')

    // ────────────────────────────────────────
    // 2. Per-IP rate limits (hourly + daily)
    // ────────────────────────────────────────
    const hourlyCheck = await checkRateLimit(getAIRateLimiter(), `ip:${ipHash}`)
    if (!hourlyCheck.allowed) {
      return NextResponse.json(
        { error: 'You\'ve made too many requests recently. Please try again in an hour.' },
        { status: 429, headers: { 'X-RateLimit-Remaining': '0' } }
      )
    }

    const dailyIpCheck = await checkRateLimit(getAIDailyIpLimiter(), `ip:${ipHash}`)
    if (!dailyIpCheck.allowed) {
      return NextResponse.json(
        { error: 'Daily request limit reached for this device. Please try again tomorrow.' },
        { status: 429 }
      )
    }

    // ────────────────────────────────────────
    // 3. Global monthly spend cap (protects your Anthropic credits)
    // ────────────────────────────────────────
    const globalCheck = await checkGlobalMonthlyAILimit()
    if (!globalCheck.allowed) {
      console.warn(
        `[generate-review] GLOBAL MONTHLY LIMIT REACHED: ${globalCheck.used}/${globalCheck.limit}`
      )
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again later.' },
        { status: 503 }
      )
    }

    // ────────────────────────────────────────
    // 4. Parse + validate request
    // ────────────────────────────────────────
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

    const {
      client_id,
      customer_name,
      service,
      team_member,
      comments,
      star_rating,
      source,
      qr_code,
    } = parsed.data

    // ────────────────────────────────────────
    // 5. Fetch client
    // ────────────────────────────────────────
    const { data: client, error: clientError } = await supabaseServer
      .from('clients')
      .select('*')
      .eq('id', client_id)
      .eq('is_active', true)
      .single()

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // ────────────────────────────────────────
    // 6. Per-client daily AI limit
    // ────────────────────────────────────────
    const clientCheck = await checkClientDailyAILimit(client.id, client.daily_ai_limit ?? 50)
    if (!clientCheck.allowed) {
      console.warn(
        `[generate-review] Client ${client.slug} hit daily limit: ${clientCheck.used}/${clientCheck.limit}`
      )
      return NextResponse.json(
        {
          error:
            'This location has reached its daily review limit. Please try again tomorrow.',
        },
        { status: 429 }
      )
    }

    // ────────────────────────────────────────
    // 7. Generate AI review
    // ────────────────────────────────────────
    const generatedReview = await generateAEOReview({
      client,
      customerName: sanitize(customer_name, 100),
      service: sanitize(service, 100),
      teamMember: sanitize(team_member, 100),
      comments: comments ? sanitize(comments, 500) : undefined,
    })

    // ────────────────────────────────────────
    // 8. Insert review row
    // ────────────────────────────────────────
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
    }

    return NextResponse.json({
      generated_review: generatedReview,
      review_id: reviewRow?.id ?? null,
    })
  } catch (error) {
    console.error(
      '[generate-review] Unhandled error:',
      error instanceof Error ? error.message : 'unknown'
    )
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
