import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { supabaseServer } from './supabase-server'

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

// ────────────────────────────────────────────────────────────
// Per-IP hourly limits (anti-abuse)
// ────────────────────────────────────────────────────────────

// 20 AI generations per IP per hour
export function getAIRateLimiter() {
  const redis = getRedis()
  if (!redis) return null
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    prefix: 'rl:ai_hour',
  })
}

// 100 AI generations per IP per day (catches users spreading abuse over hours)
export function getAIDailyIpLimiter() {
  const redis = getRedis()
  if (!redis) return null
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '24 h'),
    prefix: 'rl:ai_day_ip',
  })
}

// 10 feedback per IP per hour
export function getFeedbackRateLimiter() {
  const redis = getRedis()
  if (!redis) return null
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 h'),
    prefix: 'rl:feedback_hour',
  })
}

// ────────────────────────────────────────────────────────────
// Generic limit check helper
// ────────────────────────────────────────────────────────────
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  if (!limiter) {
    // Dev mode — no Redis
    return { allowed: true, remaining: 999, reset: 0 }
  }
  const result = await limiter.limit(identifier)
  return {
    allowed: result.success,
    remaining: result.remaining,
    reset: result.reset,
  }
}

// ────────────────────────────────────────────────────────────
// Per-client daily AI budget (prevents one location from being abused
// to drain your Anthropic credits)
// ────────────────────────────────────────────────────────────
export async function checkClientDailyAILimit(
  clientId: string,
  dailyLimit: number
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)

  const { count, error } = await supabaseServer
    .from('reviews')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .eq('review_type', 'positive')
    .gte('created_at', startOfDay.toISOString())

  if (error) {
    // Fail open — don't block on DB errors, but log
    console.error('[rate-limit] Client daily check error:', error.message)
    return { allowed: true, used: 0, limit: dailyLimit }
  }

  const used = count ?? 0
  return {
    allowed: used < dailyLimit,
    used,
    limit: dailyLimit,
  }
}

// ────────────────────────────────────────────────────────────
// GLOBAL monthly Anthropic API spend cap
// Prevents catastrophic credit drain across all clients combined.
// Set MAX_AI_REVIEWS_PER_MONTH env var (default 5000 = ~$50/mo at $0.01/review)
// ────────────────────────────────────────────────────────────
export async function checkGlobalMonthlyAILimit(): Promise<{
  allowed: boolean
  used: number
  limit: number
}> {
  const monthlyLimit = Number(process.env.MAX_AI_REVIEWS_PER_MONTH || '5000')

  const startOfMonth = new Date()
  startOfMonth.setUTCDate(1)
  startOfMonth.setUTCHours(0, 0, 0, 0)

  const { count, error } = await supabaseServer
    .from('reviews')
    .select('*', { count: 'exact', head: true })
    .eq('review_type', 'positive')
    .gte('created_at', startOfMonth.toISOString())

  if (error) {
    console.error('[rate-limit] Global monthly check error:', error.message)
    return { allowed: true, used: 0, limit: monthlyLimit }
  }

  const used = count ?? 0
  return {
    allowed: used < monthlyLimit,
    used,
    limit: monthlyLimit,
  }
}
