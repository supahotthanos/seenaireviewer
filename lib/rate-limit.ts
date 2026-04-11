import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    // In development without Upstash, skip rate limiting
    return null
  }

  return new Redis({ url, token })
}

// 5 AI generation requests per IP per hour
export function getAIRateLimiter() {
  const redis = getRedis()
  if (!redis) return null

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1 h'),
    prefix: 'rl:ai_generate',
  })
}

// 10 feedback submissions per IP per hour
export function getFeedbackRateLimiter() {
  const redis = getRedis()
  if (!redis) return null

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 h'),
    prefix: 'rl:feedback_submit',
  })
}

// Check rate limit — returns true if request is allowed, false if blocked
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  if (!limiter) {
    // No rate limiter configured — allow all requests (dev mode)
    return { allowed: true, remaining: 999, reset: 0 }
  }

  const result = await limiter.limit(identifier)
  return {
    allowed: result.success,
    remaining: result.remaining,
    reset: result.reset,
  }
}
