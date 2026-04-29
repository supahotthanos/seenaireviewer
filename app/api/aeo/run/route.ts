import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyAdminSecret } from '@/lib/admin-auth'
import { PROVIDERS, runProvider, type ProviderId } from '@/lib/aeo-providers'

// Server-side AEO model runner. The actual provider call (OpenAI / Gemini)
// happens here using keys from env vars — the browser never sees them.
//
// Admin-gated. Each request runs ONE model; the AEO tester fires N parallel
// requests (one per model in the batch) for full concurrency.

const runSchema = z.object({
  providerId: z.enum(['openai', 'google', 'anthropic']),
  modelId: z.string().min(1).max(80),
  prompt: z.string().min(1).max(4000),
  temperature: z.number().min(0).max(2).optional(),
  // When false, the runner skips the provider's web-search tool so the
  // answer reflects ONLY the model's training-data brand awareness.
  searchEnabled: z.boolean().optional(),
  // standard: today's behavior. extended: enable thinking budgets.
  // deep: route to deep-research model variants where available; cost can
  // be 10–50× standard so the UI confirms before sending these.
  reasoningMode: z.enum(['standard', 'extended', 'deep']).optional(),
  // 32-bit signed seed range. OpenAI + Google honor it; Anthropic ignores.
  seed: z.number().int().min(-2_147_483_648).max(2_147_483_647).optional(),
})

function getServerKey(providerId: ProviderId): string | null {
  if (providerId === 'openai') return process.env.OPENAI_API_KEY?.trim() || null
  if (providerId === 'google') return process.env.GOOGLE_AI_API_KEY?.trim() || null
  if (providerId === 'anthropic') return process.env.ANTHROPIC_API_KEY?.trim() || null
  return null
}

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

  const parsed = runSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
  }
  const { providerId, modelId, prompt, temperature, searchEnabled, reasoningMode, seed } = parsed.data

  const provider = PROVIDERS.find((p) => p.id === providerId)
  if (!provider) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
  }
  const model = provider.models.find((m) => m.id === modelId)
  if (!model) {
    return NextResponse.json({ error: 'Unknown model' }, { status: 400 })
  }

  const apiKey = getServerKey(providerId)
  if (!apiKey) {
    return NextResponse.json(
      { error: `${provider.name} key not configured on server` },
      { status: 503 }
    )
  }

  try {
    const result = await runProvider({
      providerId,
      model,
      apiKey,
      prompt,
      temperature,
      searchEnabled,
      reasoningMode,
      seed,
    })
    return NextResponse.json(result)
  } catch (err) {
    const raw = err instanceof Error ? err.message : 'unknown'
    // Don't echo provider errors verbatim — they sometimes contain key
    // fragments or internal request IDs. Log server-side, return generic.
    console.error('[aeo/run]', providerId, modelId, raw.slice(0, 300))
    const lc = raw.toLowerCase()
    // Check billing/quota BEFORE the 429 check — OpenAI returns 429 with
    // `insufficient_quota` for "no credit balance", which is really a
    // billing problem, not a real rate-limit.
    if (
      lc.includes('insufficient_quota') ||
      lc.includes('billing') ||
      lc.includes('credit balance') ||
      lc.includes('plan and billing') ||
      lc.includes('exceeded your current quota')
    ) {
      return NextResponse.json(
        { error: 'Provider billing issue — add credits or set up payment on this provider.' },
        { status: 402 }
      )
    }
    if (lc.includes('401') || lc.includes('unauthorized') || lc.includes('invalid api key')) {
      return NextResponse.json({ error: 'Provider rejected the API key' }, { status: 502 })
    }
    if (lc.includes('429') || lc.includes('rate_limit')) {
      return NextResponse.json({ error: 'Provider rate-limited the request — try again in a moment' }, { status: 429 })
    }
    if (lc.includes('model') && (lc.includes('not found') || lc.includes('does not exist'))) {
      return NextResponse.json({ error: 'Model unavailable on this account' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Provider call failed' }, { status: 502 })
  }
}
