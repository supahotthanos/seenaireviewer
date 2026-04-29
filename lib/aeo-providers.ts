// AEO ranking-test providers — OpenAI + Google only.
//
// API keys are pasted by the user, stored in localStorage on their device
// only. They never reach our server. All API calls go BROWSER → PROVIDER
// directly (with cache: 'no-store', credentials: 'omit',
// referrerPolicy: 'no-referrer' so that nothing leaks into the request).
//
// Pricing here is approximate (April 2026 published rates) and is used for
// the daily-spend rate-limit guardrail in AEOTester. Where two prices are
// listed for tiered context windows, we use the under-200k tier — the
// guardrail will slightly under-count cost on long prompts.

export type ProviderId = 'openai' | 'google' | 'anthropic'

export interface ModelConfig {
  id: string
  name: string
  webAccess: boolean
  // USD per 1 million tokens
  priceIn: number
  priceOut: number
  description?: string
}

export interface ProviderConfig {
  id: ProviderId
  name: string
  authPlaceholder: string
  helpUrl: string
  consoleUrl: string
  models: ModelConfig[]
}

export const PROVIDERS: ProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI (ChatGPT)',
    authPlaceholder: 'sk-...',
    helpUrl: 'https://platform.openai.com/api-keys',
    consoleUrl: 'https://platform.openai.com/usage',
    models: [
      // ── GPT-5 family (April 2026 current) ──────────────────────
      {
        id: 'gpt-5.5',
        name: 'GPT-5.5',
        webAccess: true,
        priceIn: 2.5,
        priceOut: 15,
        description: 'Newest flagship.',
      },
      {
        id: 'gpt-5.4',
        name: 'GPT-5.4',
        webAccess: true,
        priceIn: 2.5,
        priceOut: 15,
        description: 'Released March 5, 2026.',
      },
      {
        id: 'gpt-5.4-mini',
        name: 'GPT-5.4 mini',
        webAccess: true,
        priceIn: 0.5,
        priceOut: 3,
        description: 'Mid-range, ~5× cheaper than full 5.4.',
      },
      {
        id: 'gpt-5.4-nano',
        name: 'GPT-5.4 nano',
        webAccess: true,
        priceIn: 0.2,
        priceOut: 1.25,
        description: 'Cheapest in the 5.4 family.',
      },
      // Note: GPT-5.4 Pro is not exposed via the chat/completions endpoint
      // (Responses API only). Removed from the batch to keep all 27+ runs
      // simple. Use the Responses API separately if you need it.
      {
        id: 'gpt-5',
        name: 'GPT-5',
        webAccess: true,
        priceIn: 1.25,
        priceOut: 10,
        description: 'Original GPT-5 release.',
      },
      // ── Reasoning specialists ──────────────────────────────────
      {
        id: 'o3',
        name: 'o3',
        webAccess: true,
        priceIn: 2,
        priceOut: 8,
        description: 'Reasoning-specialized.',
      },
      {
        id: 'o3-mini',
        name: 'o3-mini',
        webAccess: true,
        priceIn: 1.1,
        priceOut: 4.4,
        description: 'Cheap reasoning option, between o3 and o4-mini.',
      },
      {
        id: 'o4-mini',
        name: 'o4-mini',
        webAccess: true,
        priceIn: 1.1,
        priceOut: 4.4,
        description: 'Newer cheaper reasoning.',
      },
      // ── Long-context + GPT-4 legacy ────────────────────────────
      {
        id: 'gpt-4.1',
        name: 'GPT-4.1',
        webAccess: true,
        priceIn: 2,
        priceOut: 8,
        description: 'Long-context model, still served.',
      },
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        webAccess: true,
        priceIn: 2.5,
        priceOut: 10,
        description: 'Legacy flagship — what most ChatGPT API integrations still call.',
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o mini',
        webAccess: true,
        priceIn: 0.15,
        priceOut: 0.6,
        description: 'Cheap still-served. Good for high-volume AEO checks.',
      },
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        webAccess: true,
        priceIn: 10,
        priceOut: 30,
        description: 'Older flagship, still served.',
      },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    authPlaceholder: 'sk-ant-...',
    helpUrl: 'https://console.anthropic.com/settings/keys',
    consoleUrl: 'https://console.anthropic.com/settings/usage',
    models: [
      {
        id: 'claude-opus-4-7',
        name: 'Claude Opus 4.7',
        webAccess: true,
        priceIn: 5,
        priceOut: 25,
        description: 'Newest Claude flagship (April 16, 2026).',
      },
      {
        id: 'claude-sonnet-4-6',
        name: 'Claude Sonnet 4.6',
        webAccess: true,
        priceIn: 3,
        priceOut: 15,
        description: 'Mid-tier workhorse.',
      },
      {
        id: 'claude-sonnet-4-5',
        name: 'Claude Sonnet 4.5',
        webAccess: true,
        priceIn: 3,
        priceOut: 15,
        description: 'Previous Sonnet, still widely served.',
      },
      {
        id: 'claude-haiku-4-5',
        name: 'Claude Haiku 4.5',
        webAccess: true,
        priceIn: 1,
        priceOut: 5,
        description: 'Cheapest, fastest Claude.',
      },
    ],
  },
  {
    id: 'google',
    name: 'Google (Gemini)',
    authPlaceholder: 'AIza...',
    helpUrl: 'https://aistudio.google.com/app/apikey',
    consoleUrl: 'https://aistudio.google.com/',
    models: [
      // ── Gemini 3.1 (April 2026 current — still preview) ────────
      {
        id: 'gemini-3.1-pro-preview',
        name: 'Gemini 3.1 Pro',
        webAccess: true,
        priceIn: 2,
        priceOut: 12,
        description: 'Newest flagship preview. Google Search grounded.',
      },
      {
        id: 'gemini-3.1-flash-lite-preview',
        name: 'Gemini 3.1 Flash-Lite',
        webAccess: true,
        priceIn: 0.1,
        priceOut: 0.4,
        description: 'Cheapest 3.1 tier preview.',
      },
      // ── Gemini 3 (preview tier) ───────────────────────────────
      {
        id: 'gemini-3-pro-preview',
        name: 'Gemini 3 Pro',
        webAccess: true,
        priceIn: 1.5,
        priceOut: 7.5,
        description: 'Mid-flagship preview.',
      },
      {
        id: 'gemini-3-flash-preview',
        name: 'Gemini 3 Flash',
        webAccess: true,
        priceIn: 0.3,
        priceOut: 2.5,
        description: 'Balanced 3-gen Flash preview.',
      },
      // ── Gemini 2.5 (still served, lots of integrations use it) ─
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        webAccess: true,
        priceIn: 1.25,
        priceOut: 10,
        description: '2.5 flagship with grounding.',
      },
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        webAccess: true,
        priceIn: 0.1,
        priceOut: 3,
        description: 'Fast + cheap with grounding.',
      },
      {
        id: 'gemini-2.5-flash-lite',
        name: 'Gemini 2.5 Flash-Lite',
        webAccess: true,
        priceIn: 0.1,
        priceOut: 0.4,
        description: 'Cheapest 2.5 tier.',
      },
    ],
  },
]

/**
 * Reasoning depth selector. Maps to provider-specific knobs:
 *   - standard: today's behavior — no extended thinking, normal token budgets
 *   - extended: enable provider thinking budgets where supported (Claude
 *     opus/sonnet via thinking block; Gemini 3.x via thinkingConfig); on
 *     OpenAI reasoning models, bumps max_output_tokens for headroom
 *   - deep: route to deep-research model variants where available
 *     (OpenAI o3/o4 deep-research IDs); otherwise behave like extended.
 *     Cost is 10–50× standard — UI gates this behind a confirmation.
 */
export type ReasoningMode = 'standard' | 'extended' | 'deep'

/**
 * Map of base OpenAI model id → deep-research variant id used when
 * reasoningMode === 'deep'. These variants live behind the same Responses
 * API but include the orchestration that runs multi-step research with
 * the web_search_preview tool. Cost is roughly 10–30× the base model.
 * IDs current as of 2026-04; if OpenAI rotates them, only this map needs
 * updating. Models not listed fall back to the base id with extended-mode
 * token headroom (still useful for an A/B but not "true" deep research).
 */
const DEEP_RESEARCH_OPENAI_MAP: Record<string, string> = {
  o3: 'o3-deep-research-2025-06-26',
  'o4-mini': 'o4-mini-deep-research-2025-06-26',
}

export interface RunRequest {
  providerId: ProviderId
  model: ModelConfig
  apiKey: string
  prompt: string
  // 0 = deterministic (best for reproducible ranking checks).
  // 1 = default API behavior, matches what a typical user would see.
  temperature?: number
  // When false, disable provider-level web search so the answer reflects
  // ONLY the model's training-data brand awareness. When undefined or true,
  // we attach the provider's web-search tool (default = current behavior).
  // Useful for separating "trained brand awareness" from "live ranking".
  searchEnabled?: boolean
  /**
   * Reasoning depth knob. Defaults to 'standard' (current behavior).
   * 'deep' is cost-inflating — callers should confirm with the user first.
   */
  reasoningMode?: ReasoningMode
  /**
   * Reproducibility seed. Forwarded to OpenAI (Responses + chat completions)
   * and Google (generationConfig) so identical inputs return identical
   * outputs WHEN the upstream model is in deterministic mode. Anthropic
   * does NOT expose a seed parameter, so this is silently ignored there.
   * The system_fingerprint that providers return alongside seeded calls is
   * surfaced via RunResult.systemFingerprint for drift detection.
   */
  seed?: number
  /**
   * Date string (YYYY-MM-DD) injected into the system instruction so all
   * providers see the same anchor. Eliminates the "what year does this
   * model think it is?" variance — without it, models will disagree based
   * on their training cutoffs and hallucinate seasonal context. When
   * undefined, callers should pass today's date for consistency.
   */
  injectedDate?: string
}

export interface RunResult {
  text: string
  tokensIn: number
  tokensOut: number
  costUsd: number
  durationMs: number
  citations?: string[] // URLs from web-enabled models that include them
  // The actual snapshot/fingerprint the provider resolved our alias to.
  // Critical for longitudinal AEO data — when this changes, the provider
  // silently shipped new weights and our trend chart needs a re-baseline.
  modelSnapshot?: string
  // Echo of whether the provider's web-search tool was attached to this
  // call. Lets clients tag history entries straight from the response
  // without having to thread their own flag through.
  searchEnabled: boolean
  // Echo of which reasoning mode the runner actually used. May differ
  // from the request when 'deep' falls back to 'extended' on a model
  // without a deep-research variant.
  reasoningMode: ReasoningMode
  // Seed actually sent to the provider (or undefined for providers that
  // don't expose one — e.g. Anthropic).
  seed?: number
  // Provider's per-call fingerprint of the underlying model snapshot.
  // For OpenAI this is `system_fingerprint`; Gemini does NOT return a
  // dedicated fingerprint with seeded calls so we leave it undefined.
  // When this changes for the SAME (model, seed) pair, the upstream model
  // weights have shifted and previously-reproducible runs no longer are.
  systemFingerprint?: string
  // Echo of the date string injected into the system instruction (or
  // undefined when the caller passed nothing).
  injectedDate?: string
}

/**
 * Build the system instruction we inject. Single source of truth so all
 * three providers send the same anchor text. Kept minimal so it doesn't
 * skew the model's tone or override its instructions.
 */
function buildSystemInstruction(injectedDate?: string): string | undefined {
  if (!injectedDate) return undefined
  return `Today's date is ${injectedDate}.`
}

// Common fetch options for every browser → provider API call.
// Goal: each request is treated as if it's the first time the question is
// being asked — no cached responses, no Referer header that could trigger
// per-domain rate limits or routing tweaks, no credentialed cookies.
const ISOLATED_FETCH: RequestInit = {
  cache: 'no-store',
  credentials: 'omit',
  referrerPolicy: 'no-referrer',
}

function calcCost(m: ModelConfig, tokensIn: number, tokensOut: number): number {
  return (tokensIn * m.priceIn) / 1_000_000 + (tokensOut * m.priceOut) / 1_000_000
}

// ────────────────────────────────────────────────────────────────────
// Per-provider runners
// ────────────────────────────────────────────────────────────────────

// Models known NOT to support OpenAI's Responses API + web_search_preview.
// Everything modern (gpt-4o+, gpt-4.1+, gpt-5.x, o-series) supports it.
const OPENAI_NO_WEB_SEARCH = new Set(['gpt-3.5-turbo'])

async function runOpenAI(req: RunRequest): Promise<RunResult> {
  const start = Date.now()
  const baseId = req.model.id
  const reasoning: ReasoningMode = req.reasoningMode ?? 'standard'
  // Deep research routes through dedicated model variants; if no variant
  // exists for this base model, we fall back to extended-thinking-style
  // behavior on the base id (still useful, just not "true" deep research).
  const deepVariant = reasoning === 'deep' ? DEEP_RESEARCH_OPENAI_MAP[baseId] : undefined
  const id = deepVariant ?? baseId
  const effectiveReasoning: ReasoningMode =
    reasoning === 'deep' && !deepVariant ? 'extended' : reasoning
  const isReasoning = /^o\d/i.test(id) // o1, o1-mini, o3, o3-mini, o4-mini, deep variants
  // GPT-5 (original) and GPT-5.5 lock temperature to default (1) — same
  // as reasoning models. GPT-5.4 family allows custom temperatures.
  const isLockedTemp = isReasoning || /^gpt-5(\.5)?$/i.test(id)
  const supportsWebSearch = !OPENAI_NO_WEB_SEARCH.has(id)
  const searchOn = req.searchEnabled !== false

  // ── Modern models → Responses API ──────────────────────────────
  // The Responses API (POST /v1/responses) is the modern endpoint that
  // supports tools like web_search_preview. We use it for any model
  // that can; tools are attached only when searchEnabled is on, so the
  // SAME endpoint also handles the "training-data only" case.
  if (supportsWebSearch) {
    const body: Record<string, unknown> = {
      model: id,
      input: req.prompt,
    }
    const sys = buildSystemInstruction(req.injectedDate)
    if (sys) body.instructions = sys
    if (searchOn) body.tools = [{ type: 'web_search_preview' }]
    // max_output_tokens budget grows with reasoning depth so thinking
    // models don't truncate before producing the answer. Billed only
    // for tokens actually used, so headroom is cheap when unused.
    const baseBudget = isLockedTemp ? 4000 : 1500
    const reasoningMultiplier =
      effectiveReasoning === 'deep' ? 6 : effectiveReasoning === 'extended' ? 2 : 1
    body.max_output_tokens = baseBudget * reasoningMultiplier
    if (!isLockedTemp) body.temperature = req.temperature ?? 1
    if (typeof req.seed === 'number') body.seed = req.seed

    const res = await fetch('https://api.openai.com/v1/responses', {
      ...ISOLATED_FETCH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${req.apiKey}`,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`OpenAI ${res.status}: ${err.slice(0, 300)}`)
    }
    const data = await res.json()
    // Response shape: { output: [{type:'web_search_call',...}, {type:'message', content:[{type:'output_text', text}]}], usage }
    let text = ''
    const citations: string[] = []
    for (const block of data.output || []) {
      if (block.type === 'message' && Array.isArray(block.content)) {
        for (const c of block.content) {
          if (c.type === 'output_text' && typeof c.text === 'string') {
            text += c.text
          }
          // OpenAI inlines citations as annotations on output_text
          if (Array.isArray(c.annotations)) {
            for (const ann of c.annotations) {
              if (ann.type === 'url_citation' && ann.url) citations.push(ann.url)
            }
          }
        }
      }
    }
    const tokensIn = data.usage?.input_tokens ?? 0
    const tokensOut = data.usage?.output_tokens ?? 0
    return {
      text: text.trim(),
      tokensIn,
      tokensOut,
      costUsd: calcCost(req.model, tokensIn, tokensOut),
      durationMs: Date.now() - start,
      citations: citations.length ? Array.from(new Set(citations)) : undefined,
      // OpenAI Responses API echoes the resolved model snapshot
      modelSnapshot: typeof data.model === 'string' ? data.model : undefined,
      searchEnabled: searchOn,
      reasoningMode: effectiveReasoning,
      seed: typeof req.seed === 'number' ? req.seed : undefined,
      systemFingerprint:
        typeof data.system_fingerprint === 'string' ? data.system_fingerprint : undefined,
      injectedDate: req.injectedDate,
    }
  }

  // ── Legacy chat completions for models without web search ──────
  const sysLegacy = buildSystemInstruction(req.injectedDate)
  const messages: Array<{ role: string; content: string }> = []
  if (sysLegacy) messages.push({ role: 'system', content: sysLegacy })
  messages.push({ role: 'user', content: req.prompt })
  const body: Record<string, unknown> = {
    model: id,
    messages,
    max_tokens: 1500,
    temperature: req.temperature ?? 1,
  }
  if (typeof req.seed === 'number') body.seed = req.seed
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    ...ISOLATED_FETCH,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${req.apiKey}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI ${res.status}: ${err.slice(0, 300)}`)
  }
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content || ''
  const tokensIn = data.usage?.prompt_tokens ?? 0
  const tokensOut = data.usage?.completion_tokens ?? 0
  return {
    text,
    tokensIn,
    tokensOut,
    costUsd: calcCost(req.model, tokensIn, tokensOut),
    durationMs: Date.now() - start,
    // Chat completions returns system_fingerprint when available
    modelSnapshot:
      (typeof data.system_fingerprint === 'string' && data.system_fingerprint) ||
      (typeof data.model === 'string' ? data.model : undefined),
    // Legacy chat-completions branch never attaches a search tool —
    // these are search-incapable models that fall through to here.
    searchEnabled: false,
    // Legacy chat completions has no reasoning knob; always 'standard'
    // regardless of what the caller requested.
    reasoningMode: 'standard',
    seed: typeof req.seed === 'number' ? req.seed : undefined,
    systemFingerprint:
      typeof data.system_fingerprint === 'string' ? data.system_fingerprint : undefined,
    injectedDate: req.injectedDate,
  }
}

async function runAnthropic(req: RunRequest): Promise<RunResult> {
  const start = Date.now()
  // Enable Anthropic's web search tool so Claude does live research instead
  // of guessing from training data. ~$0.01/search added to token cost.
  // When searchEnabled is explicitly false we omit the tools array entirely
  // so Claude answers from training data only.
  const searchOn = req.searchEnabled !== false
  const reasoning: ReasoningMode = req.reasoningMode ?? 'standard'
  // Extended thinking is only documented on Opus + Sonnet (3.7+, 4.x).
  // Haiku silently ignores the block today, but to be defensive we
  // gate on a name pattern instead of sending it everywhere.
  const supportsThinking = /opus|sonnet/i.test(req.model.id)
  const wantsThinking = (reasoning === 'extended' || reasoning === 'deep') && supportsThinking
  // Deep mode pushes the budget further; standard skips the block entirely.
  const thinkingBudget = reasoning === 'deep' ? 12_000 : 5_000
  // max_tokens must exceed thinking budget so the model has room to ALSO
  // produce its visible answer after thinking. Pad by ~50%.
  const maxTokens = wantsThinking ? Math.max(2000, Math.round(thinkingBudget * 1.5)) : 2000
  const body: Record<string, unknown> = {
    model: req.model.id,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: req.prompt }],
  }
  if (wantsThinking) {
    // Extended thinking REQUIRES temperature=1 (Anthropic API constraint).
    body.temperature = 1
    body.thinking = { type: 'enabled', budget_tokens: thinkingBudget }
  } else {
    body.temperature = req.temperature ?? 1
  }
  const sysAnthropic = buildSystemInstruction(req.injectedDate)
  if (sysAnthropic) body.system = sysAnthropic
  if (searchOn) {
    body.tools = [{ type: 'web_search_20250305', name: 'web_search' }]
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    ...ISOLATED_FETCH,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': req.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic ${res.status}: ${err.slice(0, 300)}`)
  }
  const data = await res.json()
  // Response is a stream of blocks: 'text' (Claude's answer chunks),
  // 'server_tool_use' (Claude calling search), 'web_search_tool_result'
  // (search results). Concatenate all the text blocks for the final answer.
  const text =
    data.content
      ?.filter((c: { type: string }) => c.type === 'text')
      .map((c: { text: string }) => c.text)
      .join('\n')
      .trim() || ''
  const tokensIn = data.usage?.input_tokens ?? 0
  const tokensOut = data.usage?.output_tokens ?? 0
  // Pull citation URLs out of any tool result blocks
  const citations: string[] = []
  for (const block of data.content || []) {
    if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
      for (const result of block.content) {
        if (result.url) citations.push(result.url)
      }
    }
  }
  return {
    text,
    tokensIn,
    tokensOut,
    costUsd: calcCost(req.model, tokensIn, tokensOut),
    durationMs: Date.now() - start,
    citations: citations.length ? citations : undefined,
    // Anthropic returns the resolved model snapshot in `model`
    modelSnapshot: typeof data.model === 'string' ? data.model : undefined,
    searchEnabled: searchOn,
    // Echo what we actually applied — falls back to 'standard' on models
    // that don't support thinking even if 'extended' was requested.
    reasoningMode: wantsThinking ? reasoning : 'standard',
    // Anthropic Messages API does NOT expose a seed parameter (no
    // documented knob as of 2026-04). We deliberately omit seed/fingerprint
    // here so callers see undefined and can act accordingly.
    seed: undefined,
    systemFingerprint: undefined,
    injectedDate: req.injectedDate,
  }
}

async function runGoogle(req: RunRequest): Promise<RunResult> {
  const start = Date.now()
  const reasoning: ReasoningMode = req.reasoningMode ?? 'standard'
  // Gemini 2.5 + 3.x families expose a thinking budget via
  // generationConfig.thinkingConfig. Older 2.x models silently ignore it.
  // We gate by id pattern rather than sending it everywhere — defensive
  // against quota errors on accounts that haven't been migrated.
  const supportsThinking = /^gemini-(2\.5|3)/i.test(req.model.id)
  const wantsThinking = (reasoning === 'extended' || reasoning === 'deep') && supportsThinking
  const thinkingBudget = reasoning === 'deep' ? 24_000 : 8_000
  const maxOutputTokens = wantsThinking ? Math.max(4000, thinkingBudget + 1000) : 1500
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${req.model.id}:generateContent?key=${encodeURIComponent(req.apiKey)}`
  const generationConfig: Record<string, unknown> = {
    maxOutputTokens,
    temperature: req.temperature ?? 1,
  }
  if (wantsThinking) {
    generationConfig.thinkingConfig = { thinkingBudget }
  }
  if (typeof req.seed === 'number') generationConfig.seed = req.seed
  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: req.prompt }], role: 'user' }],
    generationConfig,
  }
  const sysGoogle = buildSystemInstruction(req.injectedDate)
  if (sysGoogle) {
    body.systemInstruction = { parts: [{ text: sysGoogle }] }
  }
  // Gemini grounding tool is only attached when both the model supports it
  // AND search is requested for this run. Skipping it makes Gemini answer
  // from its training data only — same intent as the OpenAI/Anthropic
  // search-off branches above.
  if (req.model.webAccess && req.searchEnabled !== false) {
    body.tools = [{ google_search: {} }]
  }
  const res = await fetch(url, {
    ...ISOLATED_FETCH,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google ${res.status}: ${err.slice(0, 300)}`)
  }
  const data = await res.json()
  const cand = data.candidates?.[0]
  const text =
    cand?.content?.parts
      ?.map((p: { text?: string }) => p.text || '')
      .join('') || ''
  const tokensIn = data.usageMetadata?.promptTokenCount ?? 0
  const tokensOut = data.usageMetadata?.candidatesTokenCount ?? 0
  // Grounding metadata sometimes carries source URLs
  const citations: string[] =
    cand?.groundingMetadata?.groundingChunks
      ?.map((c: { web?: { uri?: string } }) => c.web?.uri)
      .filter(Boolean) || []
  return {
    text,
    tokensIn,
    tokensOut,
    costUsd: calcCost(req.model, tokensIn, tokensOut),
    durationMs: Date.now() - start,
    citations: citations.length ? citations : undefined,
    // Gemini returns the resolved model in `modelVersion`
    modelSnapshot: typeof data.modelVersion === 'string' ? data.modelVersion : undefined,
    // Search is attached only when the model supports grounding AND the
    // caller didn't explicitly disable it; mirror that here.
    searchEnabled: req.model.webAccess && req.searchEnabled !== false,
    // 'standard' if the model didn't support a thinking budget at all,
    // otherwise echo what we asked for.
    reasoningMode: wantsThinking ? reasoning : 'standard',
    seed: typeof req.seed === 'number' ? req.seed : undefined,
    // Gemini does not return a stable per-call fingerprint for seeded
    // generations; modelVersion already covers the snapshot side.
    systemFingerprint: undefined,
    injectedDate: req.injectedDate,
  }
}

export async function runProvider(req: RunRequest): Promise<RunResult> {
  switch (req.providerId) {
    case 'openai':
      return runOpenAI(req)
    case 'anthropic':
      return runAnthropic(req)
    case 'google':
      return runGoogle(req)
  }
}
