'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassInput } from '@/components/ui/GlassInput'
import { Toast } from '@/components/ui/Toast'
import { PROVIDERS, type ProviderId, type ModelConfig } from '@/lib/aeo-providers'
import {
  buildHighlightRegex,
  classifyAllMentions,
  countMentions,
  deriveAliases,
  extractRank,
  type RankFormat,
  type Sentiment,
} from '@/lib/aeo-mentions'

interface ClientLite {
  slug: string
  business_name: string
  location_city: string
  services: string[]
  aliases: string[]
}

/** UI-level toggle deciding whether the batch fires with web search on, off, or both. */
type SearchMode = 'on' | 'off' | 'compare'

interface RunHistory {
  id: string
  ts: number
  batchId: string
  city: string
  providerId: ProviderId
  modelName: string
  modelId: string
  modelSnapshot?: string
  prompt: string
  text: string
  tokensIn: number
  tokensOut: number
  costUsd: number
  mentions: number
  /** Unique alias surface forms found in the response (e.g. "Lov MedSpa"). */
  mentionMatches?: string[]
  /**
   * One sentiment verdict per match (positional with mentionMatches' hits).
   * Backward compat: missing on old entries → render as 'neutral'.
   */
  sentiment?: Sentiment[]
  /** ±150-char context window around each match (positional with sentiment). */
  sentimentContext?: string[]
  /** 1-indexed list position when a list structure was detected. */
  rank?: number | null
  /** Total items in the detected list (for "ranked #N of M" displays). */
  rankTotal?: number | null
  /** Which detector produced the rank ('numbered' | 'bullet' | 'prose' | 'unknown'). */
  rankFormat?: RankFormat
  /** True if this run used the provider's web-search tool. */
  searchEnabled: boolean
  durationMs: number
  citations?: string[]
  error?: string
}

interface BatchResult {
  providerId: ProviderId
  model: ModelConfig
  prompt: string // the actual paraphrase variant sent
  trialIndex: number // which trial within (model, paraphrase) cell
  /** Whether this cell fired with the provider's web-search tool attached. */
  searchEnabled: boolean
  status: 'pending' | 'success' | 'error'
  text?: string
  mentions?: number
  mentionMatches?: string[]
  sentiment?: Sentiment[]
  sentimentContext?: string[]
  rank?: number | null
  rankTotal?: number | null
  rankFormat?: RankFormat
  costUsd?: number
  durationMs?: number
  error?: string
  citations?: string[]
  modelSnapshot?: string
}

const SPEND_KEY = 'seenai_aeo_spend'
const CAP_KEY = 'seenai_aeo_daily_cap'
const HISTORY_KEY = 'seenai_aeo_history'
const SNAPSHOTS_KEY = 'seenai_aeo_snapshots'

const DEFAULT_DAILY_CAP = 5

type SpendState = { dateISO: string; spent: number }

/**
 * Per-modelId snapshot store. The snapshot string is whatever the provider
 * resolved our model alias to (OpenAI's `model` echo, Anthropic's `model`,
 * Google's `modelVersion`, or chat-completions' `system_fingerprint`).
 * When this string changes between batches we know the provider silently
 * shipped new weights — the AEO trend chart for that model needs a
 * re-baseline. lastSeenISO records when we first observed THIS snapshot.
 */
type SnapshotStore = Record<string, { snapshot: string; lastSeenISO: string }>

/** Drift alert queued for sticky display. */
type DriftAlert = {
  id: string
  modelId: string
  oldSnapshot: string
  newSnapshot: string
  /** ISO timestamp from the previously stored entry (when old was first seen). */
  prevSeenISO: string
}

function loadSnapshots(): SnapshotStore {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as SnapshotStore
    if (parsed && typeof parsed === 'object') return parsed
    return {}
  } catch {
    return {}
  }
}

function saveSnapshots(s: SnapshotStore) {
  try {
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(s))
  } catch {}
}

/** Best-effort relative formatter ("just now", "3h ago", "2d ago"). */
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return iso
  const deltaSec = Math.max(0, Math.round((Date.now() - then) / 1000))
  if (deltaSec < 60) return 'just now'
  if (deltaSec < 3600) return `${Math.round(deltaSec / 60)}m ago`
  if (deltaSec < 86400) return `${Math.round(deltaSec / 3600)}h ago`
  return `${Math.round(deltaSec / 86400)}d ago`
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function loadSpend(): SpendState {
  try {
    const raw = localStorage.getItem(SPEND_KEY)
    if (!raw) return { dateISO: todayISO(), spent: 0 }
    const parsed = JSON.parse(raw) as SpendState
    if (parsed.dateISO !== todayISO()) return { dateISO: todayISO(), spent: 0 }
    return parsed
  } catch {
    return { dateISO: todayISO(), spent: 0 }
  }
}

function saveSpend(s: SpendState) {
  localStorage.setItem(SPEND_KEY, JSON.stringify(s))
}

// Five canonical paraphrases for "best med spa in X" — varied wording AND
// location framing. The first is the simplest canonical query (closest to
// what real customers Google for); the others mix in user-perspective and
// review-anchored phrasings to test robustness. The first paraphrase is
// always used; additional ones rotate in based on the user's slider.
const PARAPHRASES: ((city: string) => string)[] = [
  (c) => `What is the best med spa in ${c}?`,
  (c) => `I'm in ${c}. What's the top-rated med spa near me?`,
  (c) => `Top medical spa in ${c} for Botox and filler?`,
  (c) => `Where should I go for the best aesthetic treatments in ${c}?`,
  (c) => `Which medspa in ${c} has the best reviews right now?`,
]

function buildPrompts(city: string, count: number): string[] {
  const n = Math.max(1, Math.min(PARAPHRASES.length, count))
  return PARAPHRASES.slice(0, n).map((fn) => fn(city))
}

function estimateBatchCost(
  models: { providerId: ProviderId; model: ModelConfig }[],
  trials: number,
  paraphrases: number,
  searchMode: SearchMode
): number {
  // Web search adds a flat per-call fee on OpenAI ($0.025) and Anthropic
  // ($0.01); Gemini bundles it in tokens. We approximate with average
  // tokens (~30 in / ~400 out) plus the search surcharge applied PER call
  // that actually attaches the search tool.
  //   - 'on'      → every call has search (+ surcharge)
  //   - 'off'     → no calls have search (no surcharge)
  //   - 'compare' → 2× calls; only the search-on half pays the surcharge
  let total = 0
  const baseCalls = trials * paraphrases
  for (const { providerId, model } of models) {
    const tokensPerCall =
      (30 * model.priceIn) / 1_000_000 + (400 * model.priceOut) / 1_000_000
    const searchSurcharge =
      providerId === 'openai' ? 0.025 : providerId === 'anthropic' ? 0.01 : 0
    if (searchMode === 'on') {
      total += (tokensPerCall + searchSurcharge) * baseCalls
    } else if (searchMode === 'off') {
      total += tokensPerCall * baseCalls
    } else {
      // compare: one search-on cell + one search-off cell per base call
      total += (tokensPerCall + searchSurcharge) * baseCalls
      total += tokensPerCall * baseCalls
    }
  }
  return total
}

export default function AEOTester({ clients }: { clients: ClientLite[] }) {
  const [cityChoice, setCityChoice] = useState<string>('')
  const [customCity, setCustomCity] = useState<string>('')
  const [serverKeys, setServerKeys] = useState<Record<ProviderId, boolean>>({
    openai: false,
    google: false,
    anthropic: false,
  })
  const [statusLoaded, setStatusLoaded] = useState(false)
  const [running, setRunning] = useState(false)
  const [batch, setBatch] = useState<BatchResult[]>([])
  const [history, setHistory] = useState<RunHistory[]>([])
  const [spend, setSpend] = useState<SpendState>({ dateISO: todayISO(), spent: 0 })
  const [dailyCap, setDailyCap] = useState<number>(DEFAULT_DAILY_CAP)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  // Per-client alias list. For each unique business_name across active
  // clients we union (a) the aliases stored on the row, and (b) auto-
  // derived variants (CamelCase splits, possessive, plural). This is what
  // mention detection AND in-text highlighting both use.
  const [aliasList, setAliasList] = useState<string[]>([])
  const [temperature, setTemperature] = useState<number>(1)
  // N trials per (model, paraphrase) cell. >1 = statistical rigor; multi-
  // run citation rate replaces the noisy single-trial signal.
  const [trials, setTrials] = useState<number>(1)
  // How many of the 5 paraphrase variants to fire per model. >1 = robustness
  // against prompt-wording sensitivity.
  const [paraphraseCount, setParaphraseCount] = useState<number>(1)
  // Search mode: 'on' (today's behavior) | 'off' (training-data only) |
  // 'compare' (fire each cell twice — once with search, once without — so
  // we can see the gap between live ranking and trained brand awareness).
  const [searchMode, setSearchMode] = useState<SearchMode>('on')
  // Drift detection: per-modelId snapshot fingerprint store. When a model's
  // snapshot changes between batches, fire a sticky alert so the operator
  // knows to re-baseline that model's trend data. Empty store = first run
  // ever; we silently seed it instead of alerting.
  const [snapshots, setSnapshots] = useState<SnapshotStore>({})
  const [driftAlerts, setDriftAlerts] = useState<DriftAlert[]>([])

  // First-load: hydrate from localStorage + check server-side key status
  useEffect(() => {
    setSpend(loadSpend())
    const cap = Number(localStorage.getItem(CAP_KEY) || DEFAULT_DAILY_CAP)
    if (!Number.isNaN(cap) && cap > 0) setDailyCap(cap)
    try {
      const raw = localStorage.getItem(HISTORY_KEY)
      if (raw) setHistory((JSON.parse(raw) as RunHistory[]).slice(0, 1000))
    } catch {}
    setSnapshots(loadSnapshots())

    fetch('/api/aeo/status')
      .then((r) => r.json())
      .then((data) => {
        setServerKeys({
          openai: Boolean(data.openai),
          google: Boolean(data.google),
          anthropic: Boolean(data.anthropic),
        })
      })
      .catch(() => {})
      .finally(() => setStatusLoaded(true))

    // Build the alias list: for each unique business_name, union the
    // operator-supplied aliases (DB column) with auto-derived variants
    // (CamelCase splits, possessive, plural). Deduped case-insensitively.
    const seenName = new Set<string>()
    const seenAlias = new Set<string>()
    const aliases: string[] = []
    for (const c of clients) {
      if (seenName.has(c.business_name)) continue
      seenName.add(c.business_name)
      const custom = (c.aliases || []).filter(Boolean)
      // If the operator supplied custom aliases, ALSO include the auto-
      // derived defaults so both worlds are covered. Custom-only would
      // miss obvious variants the operator forgot.
      for (const a of [...custom, ...deriveAliases(c.business_name)]) {
        const key = a.toLowerCase().trim()
        if (!key || seenAlias.has(key)) continue
        seenAlias.add(key)
        aliases.push(a)
      }
    }
    setAliasList(aliases)

    if (clients.length > 0) {
      setCityChoice(clients[0].location_city)
    } else {
      setCityChoice('__custom__')
    }
  }, [clients])

  const isCustom = cityChoice === '__custom__'
  const city = isCustom ? customCity.trim() : cityChoice
  const prompts = city ? buildPrompts(city, paraphraseCount) : []

  const availableModels = useMemo(() => {
    const out: { providerId: ProviderId; model: ModelConfig }[] = []
    for (const p of PROVIDERS) {
      if (!serverKeys[p.id]) continue
      for (const m of p.models) out.push({ providerId: p.id, model: m })
    }
    return out
  }, [serverKeys])

  const estimatedCost = useMemo(
    () => estimateBatchCost(availableModels, trials, paraphraseCount, searchMode),
    [availableModels, trials, paraphraseCount, searchMode]
  )
  // Compare mode doubles the call count (one search-on + one search-off per cell).
  const searchModeMultiplier = searchMode === 'compare' ? 2 : 1
  const totalCalls =
    availableModels.length * trials * paraphraseCount * searchModeMultiplier
  const remainingBudget = Math.max(0, dailyCap - spend.spent)
  const overBudget = spend.spent >= dailyCap
  const wouldExceed = estimatedCost > remainingBudget

  const updateCap = (next: number) => {
    setDailyCap(next)
    localStorage.setItem(CAP_KEY, String(next))
  }

  // Detect mentions using the full alias list (custom + auto-derived).
  // Returns count + the unique surface forms that actually matched, so
  // the UI can show "the model spelled it 'Lov MedSpa'".
  const detectMentions = (text: string) => countMentions(text, aliasList)

  const handleRunAll = async () => {
    if (!city) {
      setToast({ message: 'Pick or enter a city', type: 'error' })
      return
    }
    if (availableModels.length === 0) {
      setToast({ message: 'No providers configured server-side', type: 'error' })
      return
    }
    if (overBudget) {
      setToast({ message: 'Daily spend cap reached', type: 'error' })
      return
    }

    const batchId = crypto.randomUUID()

    // Build the cell list: every (model × paraphrase × trial × searchFlag)
    // combination is one independent API call. In compare mode each base
    // cell expands into TWO calls (search-on + search-off) so we can A/B
    // training-data answers against live-search answers.
    type Cell = {
      providerId: ProviderId
      model: ModelConfig
      prompt: string
      trialIndex: number
      searchEnabled: boolean
    }
    const searchFlags: boolean[] =
      searchMode === 'on' ? [true]
      : searchMode === 'off' ? [false]
      : [true, false]
    const cells: Cell[] = []
    for (const { providerId, model } of availableModels) {
      for (const p of prompts) {
        for (let t = 0; t < trials; t++) {
          for (const flag of searchFlags) {
            cells.push({ providerId, model, prompt: p, trialIndex: t, searchEnabled: flag })
          }
        }
      }
    }

    const initial: BatchResult[] = cells.map((c) => ({
      providerId: c.providerId,
      model: c.model,
      prompt: c.prompt,
      trialIndex: c.trialIndex,
      searchEnabled: c.searchEnabled,
      status: 'pending',
    }))
    setBatch(initial)
    setRunning(true)

    const newHistoryEntries: RunHistory[] = []
    let runningSpend = spend.spent

    await Promise.all(
      cells.map(async (c, i) => {
        try {
          const res = await fetch('/api/aeo/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              providerId: c.providerId,
              modelId: c.model.id,
              prompt: c.prompt,
              temperature,
              searchEnabled: c.searchEnabled,
            }),
          })
          const r = await res.json()
          if (!res.ok) {
            throw new Error(r.error || `${res.status}`)
          }
          const mentionResult = detectMentions(r.text)
          const rankResult = extractRank(r.text, mentionResult.matches)
          // Per-hit sentiment classification (rule-based heuristic, see
          // classifyMentionSentiment for details + v2 LLM TODO).
          const { sentiments, contexts } = classifyAllMentions(r.text, mentionResult.hits)
          runningSpend += r.costUsd

          setBatch((prev) => {
            const next = [...prev]
            next[i] = {
              ...c,
              status: 'success',
              text: r.text,
              mentions: mentionResult.count,
              mentionMatches: mentionResult.matches,
              sentiment: sentiments,
              sentimentContext: contexts,
              rank: rankResult.rank,
              rankTotal: rankResult.totalItems,
              rankFormat: rankResult.format,
              costUsd: r.costUsd,
              durationMs: r.durationMs,
              citations: r.citations,
              modelSnapshot: r.modelSnapshot,
            }
            return next
          })

          newHistoryEntries.push({
            id: crypto.randomUUID(),
            ts: Date.now(),
            batchId,
            city,
            providerId: c.providerId,
            modelName: c.model.name,
            modelId: c.model.id,
            modelSnapshot: r.modelSnapshot,
            prompt: c.prompt,
            text: r.text,
            tokensIn: r.tokensIn,
            tokensOut: r.tokensOut,
            costUsd: r.costUsd,
            mentions: mentionResult.count,
            mentionMatches: mentionResult.matches,
            sentiment: sentiments,
            sentimentContext: contexts,
            rank: rankResult.rank,
            rankTotal: rankResult.totalItems,
            rankFormat: rankResult.format,
            searchEnabled: c.searchEnabled,
            durationMs: r.durationMs,
            citations: r.citations,
          })
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Run failed'
          setBatch((prev) => {
            const next = [...prev]
            next[i] = { ...c, status: 'error', error: msg }
            return next
          })
          newHistoryEntries.push({
            id: crypto.randomUUID(),
            ts: Date.now(),
            batchId,
            city,
            providerId: c.providerId,
            modelName: c.model.name,
            modelId: c.model.id,
            prompt: c.prompt,
            text: '',
            tokensIn: 0,
            tokensOut: 0,
            costUsd: 0,
            mentions: 0,
            searchEnabled: c.searchEnabled,
            durationMs: 0,
            error: msg,
          })
        }
      })
    )

    const newSpend = { dateISO: todayISO(), spent: runningSpend }
    saveSpend(newSpend)
    setSpend(newSpend)

    const nextHistory = [...newHistoryEntries, ...history].slice(0, 1000)
    setHistory(nextHistory)
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory))
    } catch {}

    // ── Snapshot drift detection ─────────────────────────────────
    // Pull one snapshot per modelId from this batch (first non-empty
    // successful response wins — per-model snapshots are stable within a
    // single batch). Compare each against the persisted store; alert when
    // it differs from a previously-recorded value, silently seed when the
    // entry doesn't exist yet, and skip empty/null snapshots entirely
    // (those signal a provider parsing bug, not a real model swap).
    const seenSnapshots = new Map<string, string>()
    for (const h of newHistoryEntries) {
      if (h.error) continue
      const snap = (h.modelSnapshot || '').trim()
      if (!snap) continue
      if (!seenSnapshots.has(h.modelId)) seenSnapshots.set(h.modelId, snap)
    }
    if (seenSnapshots.size > 0) {
      const nextStore: SnapshotStore = { ...snapshots }
      const newAlerts: DriftAlert[] = []
      const nowISO = new Date().toISOString()
      for (const [modelId, newSnap] of Array.from(seenSnapshots.entries())) {
        const prev = nextStore[modelId]
        if (!prev) {
          // First time we've ever recorded a snapshot for this model — seed
          // silently. Operators don't want a false-positive drift alert on
          // their very first batch.
          nextStore[modelId] = { snapshot: newSnap, lastSeenISO: nowISO }
        } else if (prev.snapshot !== newSnap) {
          newAlerts.push({
            id: crypto.randomUUID(),
            modelId,
            oldSnapshot: prev.snapshot,
            newSnapshot: newSnap,
            prevSeenISO: prev.lastSeenISO,
          })
          nextStore[modelId] = { snapshot: newSnap, lastSeenISO: nowISO }
        }
        // If snapshot matches, leave the store entry unchanged (keeps the
        // ORIGINAL lastSeenISO so we can answer "how long has this model
        // been on this snapshot?" later, not "when did we last poll it?").
      }
      setSnapshots(nextStore)
      saveSnapshots(nextStore)
      if (newAlerts.length > 0) {
        setDriftAlerts((prev) => [...prev, ...newAlerts])
      }
    }

    // Per-model citation rate: across all trials × paraphrases, what
    // fraction mentioned the client at least once?
    const byModel = new Map<string, { runs: number; mentioned: number }>()
    for (const h of newHistoryEntries) {
      if (h.error) continue
      const k = h.modelName
      if (!byModel.has(k)) byModel.set(k, { runs: 0, mentioned: 0 })
      const m = byModel.get(k)!
      m.runs++
      if (h.mentions > 0) m.mentioned++
    }
    const totalRuns = newHistoryEntries.filter((h) => !h.error).length
    const modelsMentioning = Array.from(byModel.values()).filter((v) => v.mentioned > 0).length
    setToast({
      message:
        totalRuns === 0
          ? 'All runs failed — check server keys'
          : `${modelsMentioning}/${byModel.size} models mentioned client across ${totalRuns} runs`,
      type: modelsMentioning > 0 ? 'success' : 'error',
    })
    setRunning(false)
  }

  // Memoize the regex per aliasList — rebuilt only when the list changes.
  const highlightRegex = useMemo(() => buildHighlightRegex(aliasList), [aliasList])

  const renderHighlighted = (text: string) => {
    if (!highlightRegex || !text) return text
    const parts = text.split(highlightRegex)
    return parts.map((p, i) =>
      i % 2 === 1 ? (
        <mark key={i} className="bg-[#b4caff]/30 text-[#b4caff] px-0.5 rounded font-medium">
          {p}
        </mark>
      ) : (
        <span key={i}>{p}</span>
      )
    )
  }

  const cityOptions = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const c of clients) {
      if (!seen.has(c.location_city)) {
        seen.add(c.location_city)
        out.push(c.location_city)
      }
    }
    return out
  }, [clients])

  return (
    <>
      <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-3xl font-light mb-1">
            <span className="text-[#b4caff]">Seen</span>
            <span className="text-[#b4caff]/80">AI</span>
            <span className="text-[#b4caff]/80 ml-3 text-2xl">AEO Ranking Test</span>
          </h1>
          <p className="text-white/70 text-sm font-sans">
            One prompt, every major chat model, one click. Track over time.
          </p>
        </div>
        <Link href="/admin" className="text-white/70 hover:text-[#b4caff] text-sm font-sans transition-colors">
          ← Back to admin
        </Link>
      </header>

      {/* SERVER KEY STATUS */}
      <GlassCard className="mb-6">
        <h2 className="font-serif text-xl text-[#b4caff] mb-3 font-light">Provider keys</h2>
        <p className="text-xs text-white/70 mb-3 font-sans">
          Keys live in <code className="text-[#b4caff]/80 bg-black/20 px-1 rounded">.env.local</code> on the server. The browser never sees them. Set <code className="text-[#b4caff]/80 bg-black/20 px-1 rounded">OPENAI_API_KEY</code> and <code className="text-[#b4caff]/80 bg-black/20 px-1 rounded">GOOGLE_AI_API_KEY</code> in your environment, then redeploy.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PROVIDERS.map((p) => {
            const ok = serverKeys[p.id]
            return (
              <div
                key={p.id}
                className={`p-3 rounded-xl border ${ok ? 'bg-[#b4caff]/10 border-[#b4caff]/40' : 'bg-white/5 border-white/10'}`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-sans text-sm text-white">{p.name}</span>
                  {statusLoaded ? (
                    ok ? (
                      <span className="text-xs bg-[#b4caff]/20 text-[#b4caff] border border-[#b4caff]/40 px-2 py-0.5 rounded">
                        ✓ configured
                      </span>
                    ) : (
                      <span className="text-xs bg-white/10 text-white/60 border border-white/15 px-2 py-0.5 rounded">
                        not set
                      </span>
                    )
                  ) : (
                    <span className="text-xs text-white/50">checking…</span>
                  )}
                </div>
                <div className="text-xs text-white/60 font-sans">{p.models.length} models</div>
                {!ok && statusLoaded && (
                  <a
                    href={p.helpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#b4caff] hover:underline text-xs font-sans mt-1 inline-block"
                  >
                    Get a key ↗
                  </a>
                )}
              </div>
            )
          })}
        </div>
      </GlassCard>

      {/* SPEND METER */}
      <GlassCard className="mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-sans text-white/70 uppercase tracking-widest">Today&apos;s spend</p>
            <p className="text-2xl font-serif text-[#b4caff]">
              ${spend.spent.toFixed(4)}{' '}
              <span className="text-white/50 text-base">/ ${dailyCap.toFixed(2)}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-sans text-white/70 uppercase tracking-widest">Daily cap $</label>
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={dailyCap}
              onChange={(e) => updateCap(Math.max(0.5, Number(e.target.value) || DEFAULT_DAILY_CAP))}
              className="w-24 bg-[color:var(--surface)] border border-[color:var(--border)] rounded-lg px-3 py-2 text-white text-[16px] font-mono"
            />
          </div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${overBudget ? 'bg-red-500' : 'bg-[#b4caff]'}`}
            style={{ width: `${Math.min(100, (spend.spent / dailyCap) * 100)}%` }}
          />
        </div>
      </GlassCard>

      {/* CITY + PROMPT */}
      <GlassCard className="mb-6">
        <h2 className="font-serif text-xl text-[#b4caff] mb-3 font-light">City</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {cityOptions.map((c) => {
            const active = cityChoice === c
            return (
              <button
                key={c}
                onClick={() => setCityChoice(c)}
                className={`
                  px-3 py-2 text-sm font-sans rounded-lg border transition-colors
                  ${active
                    ? 'bg-[#b4caff]/20 text-[#b4caff] border-[#b4caff]/60'
                    : 'bg-white/5 text-white/70 border-white/10 hover:border-[#b4caff]/40'}
                `}
              >
                {c}
              </button>
            )
          })}
          <button
            onClick={() => setCityChoice('__custom__')}
            className={`
              px-3 py-2 text-sm font-sans rounded-lg border transition-colors
              ${isCustom
                ? 'bg-[#b4caff]/20 text-[#b4caff] border-[#b4caff]/60'
                : 'bg-white/5 text-white/70 border-white/10 hover:border-[#b4caff]/40'}
            `}
          >
            Custom…
          </button>
        </div>

        {isCustom && (
          <div className="mb-3">
            <GlassInput
              placeholder="e.g. Austin, TX"
              value={customCity}
              onChange={(e) => setCustomCity(e.target.value.slice(0, 80))}
              autoFocus
            />
          </div>
        )}

        <div className="bg-black/20 rounded-xl p-3 border border-white/5">
          <p className="text-[#b4caff]/80 text-xs font-sans uppercase tracking-widest mb-2">
            Prompts sent to every model ({prompts.length} variant{prompts.length !== 1 ? 's' : ''})
          </p>
          {prompts.length > 0 ? (
            <ol className="space-y-1 list-decimal list-inside text-white text-sm font-mono">
              {prompts.map((p, i) => (
                <li key={i} className="break-words marker:text-[#b4caff]/60">
                  {p}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-white/40 italic text-sm">Pick a city above</p>
          )}
        </div>

        {/* Trials + paraphrases + temperature controls */}
        <div className="mt-5 space-y-4">
          <div>
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <label className="text-sm text-[color:var(--text-muted)] font-sans">
                Trials per (model, prompt)
                <span className="text-[#b4caff] font-mono ml-2">{trials}</span>
              </label>
              <span className="text-xs text-white/50 font-sans">
                {trials === 1 ? 'fast / single run' : `${trials}× — better statistics`}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={trials}
              onChange={(e) => setTrials(Number(e.target.value))}
              className="w-full accent-[#b4caff]"
            />
            <p className="text-xs text-white/60 font-sans mt-1">
              Higher = more reliable mention-rate signal. The guide recommends N≥5 for publishable data; 1 is fine for daily monitoring.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <label className="text-sm text-[color:var(--text-muted)] font-sans">
                Prompt paraphrases
                <span className="text-[#b4caff] font-mono ml-2">{paraphraseCount} of {PARAPHRASES.length}</span>
              </label>
              <span className="text-xs text-white/50 font-sans">
                {paraphraseCount === 1 ? 'canonical only' : `${paraphraseCount}× — robust to wording`}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={PARAPHRASES.length}
              step={1}
              value={paraphraseCount}
              onChange={(e) => setParaphraseCount(Number(e.target.value))}
              className="w-full accent-[#b4caff]"
            />
            <p className="text-xs text-white/60 font-sans mt-1">
              Higher = tests prompt-wording sensitivity. Each variant fires {trials} trial{trials !== 1 ? 's' : ''} per model.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <label className="text-sm text-[color:var(--text-muted)] font-sans">
                Search mode
                <span className="text-[#b4caff] font-mono ml-2">
                  {searchMode === 'on' ? 'ON' : searchMode === 'off' ? 'OFF' : 'compare'}
                </span>
              </label>
              <span className="text-xs text-white/50 font-sans">
                {searchMode === 'on'
                  ? 'live ranking'
                  : searchMode === 'off'
                  ? 'training-data only'
                  : '2× calls — A/B both modes'}
              </span>
            </div>
            <div role="radiogroup" aria-label="Search mode" className="grid grid-cols-3 gap-2">
              {([
                { id: 'on', label: 'Web search ON', sub: 'live web' },
                { id: 'off', label: 'Web search OFF', sub: 'training only' },
                { id: 'compare', label: 'Compare both', sub: '2× calls' },
              ] as { id: SearchMode; label: string; sub: string }[]).map((opt) => {
                const active = searchMode === opt.id
                return (
                  <button
                    key={opt.id}
                    role="radio"
                    aria-checked={active}
                    type="button"
                    onClick={() => setSearchMode(opt.id)}
                    className={`
                      px-3 py-2 text-sm font-sans rounded-lg border text-left transition-colors
                      ${active
                        ? 'bg-[#b4caff]/20 text-[#b4caff] border-[#b4caff]/60'
                        : 'bg-white/5 text-white/70 border-white/10 hover:border-[#b4caff]/40'}
                    `}
                  >
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-[10px] uppercase tracking-widest text-white/50">
                      {opt.sub}
                    </div>
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-white/60 font-sans mt-1">
              ON tests live ranking (what real customers see today); OFF tests trained brand awareness; Compare doubles the calls and runs both for an A/B gap.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <label className="text-sm text-[color:var(--text-muted)] font-sans">
                Temperature
                <span className="text-[#b4caff] font-mono ml-2">{temperature.toFixed(2)}</span>
              </label>
              <span className="text-xs text-white/50 font-sans">
                {temperature === 0 ? 'reproducible' : temperature >= 1 ? 'realistic' : 'mixed'}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="w-full accent-[#b4caff]"
            />
          </div>
        </div>
      </GlassCard>

      {/* RUN ALL */}
      <GlassCard className="mb-6">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="font-serif text-xl text-[#b4caff] font-light">
            Run batch
          </h2>
          <span className="text-xs font-sans text-white/70">
            <span className="text-[#b4caff]">{totalCalls}</span> calls · est{' '}
            <span className="text-[#b4caff]">~${estimatedCost.toFixed(3)}</span>
          </span>
        </div>
        <p className="text-xs text-white/60 font-sans mb-3">
          {availableModels.length} model{availableModels.length !== 1 ? 's' : ''} ×{' '}
          {paraphraseCount} paraphrase{paraphraseCount !== 1 ? 's' : ''} ×{' '}
          {trials} trial{trials !== 1 ? 's' : ''}
          {searchMode === 'compare' ? ' × 2 (search ON + OFF)' : ''} = {totalCalls} parallel API call{totalCalls !== 1 ? 's' : ''}
          {' · search '}
          <span className="text-[#b4caff]">
            {searchMode === 'on' ? 'ON' : searchMode === 'off' ? 'OFF' : 'A/B'}
          </span>
        </p>
        <GlassButton
          variant="admin"
          onClick={handleRunAll}
          loading={running}
          disabled={!city || availableModels.length === 0 || overBudget || wouldExceed}
          fullWidth
        >
          {running
            ? `Running… ${batch.filter((b) => b.status !== 'pending').length}/${batch.length}`
            : `Run ${totalCalls} call${totalCalls !== 1 ? 's' : ''}`}
        </GlassButton>
        {availableModels.length === 0 && statusLoaded && (
          <p className="text-white/60 text-xs font-sans mt-2 text-center">
            Set <code className="text-[#b4caff]/80 bg-black/20 px-1 rounded">OPENAI_API_KEY</code> or <code className="text-[#b4caff]/80 bg-black/20 px-1 rounded">GOOGLE_AI_API_KEY</code> in <code className="text-[#b4caff]/80 bg-black/20 px-1 rounded">.env.local</code> + Vercel env, then redeploy.
          </p>
        )}
        {wouldExceed && (
          <p className="text-red-400 text-xs font-sans mt-2 text-center">
            Estimated cost would exceed today&apos;s remaining budget (${remainingBudget.toFixed(4)}).
          </p>
        )}
      </GlassCard>

      {batch.length > 0 && <BatchPanel batch={batch} renderHighlighted={renderHighlighted} />}

      <details className="mb-6">
        <summary className="text-sm text-[#b4caff]/80 hover:text-[#b4caff] cursor-pointer font-sans select-none transition-colors">
          About test isolation — what affects answers and what doesn&apos;t ↓
        </summary>
        <GlassCard className="mt-2">
          <div className="space-y-3 text-sm font-sans">
            <div>
              <p className="text-[#b4caff] font-medium mb-1">What this tester guarantees</p>
              <ul className="space-y-0.5 text-white/80 list-disc list-inside marker:text-[#b4caff]/60">
                <li>Every API call is single-turn. No conversation history is passed.</li>
                <li>Calls go server → provider directly. No browser cookies for chatgpt.com / gemini.google.com are involved.</li>
                <li><code className="text-[#b4caff]/80 text-xs bg-black/20 px-1 rounded">cache: &apos;no-store&apos;</code>, <code className="text-[#b4caff]/80 text-xs bg-black/20 px-1 rounded">credentials: &apos;omit&apos;</code>, <code className="text-[#b4caff]/80 text-xs bg-black/20 px-1 rounded">referrerPolicy: &apos;no-referrer&apos;</code> on every call.</li>
                <li>API keys live server-side in <code className="text-[#b4caff]/80 text-xs bg-black/20 px-1 rounded">.env.local</code> / Vercel env. The browser never has them.</li>
              </ul>
            </div>
            <div>
              <p className="text-[#b4caff] font-medium mb-1">Inherent variance</p>
              <ul className="space-y-0.5 text-white/80 list-disc list-inside marker:text-[#b4caff]/60">
                <li>Live web index for Gemini — answers shift as Google&apos;s index updates.</li>
                <li>Server IP geolocation (Vercel routes from US data centers — may bias toward US-leaning answers).</li>
                <li>Provider account tier / regional routing.</li>
                <li>Temperature randomness above 0.</li>
              </ul>
            </div>
          </div>
        </GlassCard>
      </details>

      <details className="mb-6">
        <summary className="text-sm text-[#b4caff]/80 hover:text-[#b4caff] cursor-pointer font-sans select-none transition-colors">
          Snapshots — tracked model fingerprints ({Object.keys(snapshots).length}) ↓
        </summary>
        <GlassCard className="mt-2">
          <p className="text-xs text-white/70 font-sans mb-3">
            Each row is the latest provider-resolved fingerprint for that model id.
            When this string changes between batches, it means the provider silently
            shipped new weights — the AEO trend chart for that model needs a re-baseline,
            and you&apos;ll see a sticky <span className="text-amber-300">drift</span> alert
            after the run that detected it.
          </p>
          {Object.keys(snapshots).length === 0 ? (
            <p className="text-white/50 italic text-sm font-sans">
              No snapshots tracked yet. Run a batch to seed.
            </p>
          ) : (
            <div className="divide-y divide-white/5">
              {Object.entries(snapshots)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([modelId, entry]) => (
                  <div
                    key={modelId}
                    className="py-2 grid grid-cols-12 gap-3 items-center text-sm font-sans"
                  >
                    <span className="col-span-4 text-white truncate font-mono text-xs">
                      {modelId}
                    </span>
                    <span
                      className="col-span-5 text-[#b4caff]/80 truncate font-mono text-xs"
                      title={entry.snapshot}
                    >
                      {entry.snapshot}
                    </span>
                    <span
                      className="col-span-3 text-white/60 text-right text-xs"
                      title={entry.lastSeenISO}
                    >
                      first seen {formatRelative(entry.lastSeenISO)}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </GlassCard>
      </details>

      {history.length > 0 && <DashboardSection history={history} />}

      {/*
        Sticky drift alerts stack ABOVE the transient batch-summary toast.
        Each alert is dismissable; offsetBottom spaces them ~70px apart so
        a multi-model drift event doesn't overlap a single popup.
      */}
      {driftAlerts.map((a, i) => (
        <Toast
          key={a.id}
          type="warning"
          sticky
          offsetBottom={24 + (toast ? 70 : 0) + i * 70}
          message={`⚠️ Model drift detected: ${a.modelId} changed from "${a.oldSnapshot}" to "${a.newSnapshot}" since ${formatRelative(a.prevSeenISO)}.`}
          onDismiss={() =>
            setDriftAlerts((prev) => prev.filter((x) => x.id !== a.id))
          }
        />
      ))}

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </>
  )
}

function BatchPanel({
  batch,
  renderHighlighted,
}: {
  batch: BatchResult[]
  renderHighlighted: (text: string) => React.ReactNode
}) {
  const [expandedModel, setExpandedModel] = useState<string | null>(null)

  // Group cells by model so the panel shows ONE row per model with an
  // aggregate "X / N trials mentioned" badge, instead of N rows per model.
  type Group = {
    modelKey: string
    providerId: ProviderId
    model: ModelConfig
    cells: BatchResult[]
  }
  const groups: Group[] = []
  const groupIndex = new Map<string, Group>()
  for (const r of batch) {
    const key = r.providerId + ':' + r.model.id
    let g = groupIndex.get(key)
    if (!g) {
      g = { modelKey: key, providerId: r.providerId, model: r.model, cells: [] }
      groupIndex.set(key, g)
      groups.push(g)
    }
    g.cells.push(r)
  }

  // Sort groups: best mention rate → worst → errors
  groups.sort((a, b) => {
    const rate = (g: Group) => {
      const ok = g.cells.filter((c) => c.status === 'success')
      if (ok.length === 0) return -1
      return ok.filter((c) => (c.mentions || 0) > 0).length / ok.length
    }
    return rate(b) - rate(a)
  })

  return (
    <GlassCard className="mb-6">
      <h2 className="font-serif text-xl text-[#b4caff] mb-3 font-light">Latest batch results</h2>
      <div className="divide-y divide-white/5">
        {groups.map((g) => {
          const isOpen = expandedModel === g.modelKey
          const total = g.cells.length
          const done = g.cells.filter((c) => c.status !== 'pending').length
          const successes = g.cells.filter((c) => c.status === 'success')
          const mentioned = successes.filter((c) => (c.mentions || 0) > 0).length
          const errors = g.cells.filter((c) => c.status === 'error').length
          const rate = successes.length > 0 ? Math.round((mentioned / successes.length) * 100) : 0
          const totalCost = g.cells.reduce((s, c) => s + (c.costUsd || 0), 0)
          const avgDuration =
            successes.length > 0
              ? Math.round(successes.reduce((s, c) => s + (c.durationMs || 0), 0) / successes.length)
              : 0
          const snapshot = successes[0]?.modelSnapshot

          // Compare-mode split: if this model was run with both search-on
          // and search-off cells, surface them as two sub-badges so the
          // operator can see the gap (live ranking vs trained awareness)
          // at a glance instead of one merged number that hides it.
          const onSuccesses = successes.filter((c) => c.searchEnabled === true)
          const offSuccesses = successes.filter((c) => c.searchEnabled === false)
          const hasBoth = onSuccesses.length > 0 && offSuccesses.length > 0
          const onMentioned = onSuccesses.filter((c) => (c.mentions || 0) > 0).length
          const offMentioned = offSuccesses.filter((c) => (c.mentions || 0) > 0).length
          const onRate = onSuccesses.length > 0 ? Math.round((onMentioned / onSuccesses.length) * 100) : 0
          const offRate = offSuccesses.length > 0 ? Math.round((offMentioned / offSuccesses.length) * 100) : 0

          return (
            <div key={g.modelKey} className="py-3">
              <button
                onClick={() => setExpandedModel(isOpen ? null : g.modelKey)}
                className="w-full flex items-center justify-between gap-3 text-left"
              >
                <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                  <span className="text-white text-sm font-sans truncate">{g.model.name}</span>
                  {g.model.webAccess && (
                    <span className="text-[10px] uppercase tracking-widest font-sans bg-[#b4caff]/15 text-[#b4caff] border border-[#b4caff]/30 px-1.5 py-0.5 rounded">
                      web
                    </span>
                  )}
                  {done < total ? (
                    <span className="text-xs text-white/60">
                      running… {done}/{total}
                    </span>
                  ) : successes.length === 0 ? (
                    <span className="text-xs bg-red-500/15 text-red-400 border border-red-500/30 px-2 py-0.5 rounded">
                      all {total} failed
                    </span>
                  ) : hasBoth ? (
                    <>
                      <span
                        title="web search ON — live ranking"
                        className={`text-xs px-2 py-0.5 rounded border ${
                          onRate >= 60
                            ? 'bg-[#b4caff]/20 text-[#b4caff] border-[#b4caff]/50'
                            : onRate >= 1
                            ? 'bg-[#b4caff]/10 text-[#b4caff] border-[#b4caff]/30'
                            : 'bg-white/5 text-white/60 border-white/10'
                        }`}
                      >
                        🌐 ON: {onMentioned}/{onSuccesses.length} ({onRate}%)
                      </span>
                      <span
                        title="web search OFF — training-data brand awareness"
                        className={`text-xs px-2 py-0.5 rounded border ${
                          offRate >= 60
                            ? 'bg-amber-300/20 text-amber-200 border-amber-300/50'
                            : offRate >= 1
                            ? 'bg-amber-300/10 text-amber-200 border-amber-300/30'
                            : 'bg-white/5 text-white/60 border-white/10'
                        }`}
                      >
                        💭 OFF: {offMentioned}/{offSuccesses.length} ({offRate}%)
                      </span>
                      {errors > 0 && (
                        <span className="text-xs bg-red-500/10 text-red-400/80 border border-red-500/20 px-1.5 py-0.5 rounded">
                          {errors} err
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span
                        className={`text-xs px-2 py-0.5 rounded border ${
                          rate >= 60
                            ? 'bg-[#b4caff]/20 text-[#b4caff] border-[#b4caff]/50'
                            : rate >= 1
                            ? 'bg-[#b4caff]/10 text-[#b4caff] border-[#b4caff]/30'
                            : 'bg-white/5 text-white/60 border-white/10'
                        }`}
                      >
                        {mentioned}/{successes.length} mentioned ({rate}%)
                      </span>
                      {errors > 0 && (
                        <span className="text-xs bg-red-500/10 text-red-400/80 border border-red-500/20 px-1.5 py-0.5 rounded">
                          {errors} err
                        </span>
                      )}
                    </>
                  )}
                </div>
                <span className="text-xs text-white/60 shrink-0">
                  {done === total && successes.length > 0 && (
                    <>
                      ${totalCost.toFixed(4)} · avg {avgDuration}ms
                    </>
                  )}
                  {done < total && <span className="text-[#b4caff]/60">…</span>}
                </span>
              </button>

              {isOpen && (
                <div className="mt-3 pl-4 border-l-2 border-[#b4caff]/20 space-y-3">
                  {snapshot && (
                    <p className="text-xs font-mono text-[#b4caff]/60">
                      snapshot: {snapshot}
                    </p>
                  )}
                  {g.cells.map((c, i) => (
                    <div key={i} className="bg-black/15 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-2 mb-1.5 text-xs font-sans">
                        <span className="text-[#b4caff]/80 truncate flex items-center gap-1.5">
                          <span
                            title={
                              c.searchEnabled
                                ? 'web search ON — live ranking'
                                : 'web search OFF — training-data only'
                            }
                            className={`shrink-0 px-1.5 py-0.5 rounded font-mono text-[10px] uppercase tracking-widest border ${
                              c.searchEnabled
                                ? 'bg-[#b4caff]/15 text-[#b4caff] border-[#b4caff]/30'
                                : 'bg-amber-300/10 text-amber-200 border-amber-300/30'
                            }`}
                          >
                            {c.searchEnabled ? '🌐 on' : '💭 off'}
                          </span>
                          <span className="truncate">Trial {c.trialIndex + 1} · {c.prompt}</span>
                          {c.status === 'success' && c.rank != null && (
                            <span
                              title={`detected via ${c.rankFormat} list`}
                              className="shrink-0 bg-[#b4caff]/20 text-[#b4caff] border border-[#b4caff]/40 px-1.5 py-0.5 rounded font-mono"
                            >
                              #{c.rank}
                              {c.rankTotal != null && c.rankTotal >= c.rank ? ` of ${c.rankTotal}` : ''}
                            </span>
                          )}
                        </span>
                        <span className="text-white/60 shrink-0">
                          {c.status === 'success' && (
                            <>
                              {(c.mentions || 0) > 0 ? (
                                <span className="text-[#b4caff]">✓ {c.mentions}</span>
                              ) : (
                                <span className="text-white/50">no mention</span>
                              )}
                              {' · '}${c.costUsd?.toFixed(5)} · {c.durationMs}ms
                            </>
                          )}
                          {c.status === 'error' && <span className="text-red-400">error</span>}
                          {c.status === 'pending' && <span className="text-[#b4caff]/60">…</span>}
                        </span>
                      </div>
                      {c.status === 'success' && c.text && (
                        <p className="text-white/85 text-sm font-sans whitespace-pre-wrap leading-relaxed">
                          {renderHighlighted(c.text)}
                        </p>
                      )}
                      {/* Show the exact spelling the model used + a sentiment
                          chip per match. Hover the chip for the context
                          window the classifier saw. */}
                      {c.status === 'success' && c.mentionMatches && c.mentionMatches.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-sans">
                          <span className="text-[#b4caff]/60 uppercase tracking-widest">
                            spelled
                          </span>
                          {c.mentionMatches.map((m, j) => (
                            <span
                              key={j}
                              className="bg-[#b4caff]/15 text-[#b4caff] border border-[#b4caff]/30 px-2 py-0.5 rounded font-mono"
                            >
                              {m}
                            </span>
                          ))}
                          {c.sentiment && c.sentiment.length > 0 && (
                            <>
                              <span className="text-white/30 px-1">·</span>
                              {c.sentiment.map((s, j) => {
                                const ctx = c.sentimentContext?.[j] || ''
                                const palette =
                                  s === 'positive'
                                    ? 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30'
                                    : s === 'negative'
                                    ? 'bg-red-400/15 text-red-300 border-red-400/30'
                                    : s === 'mixed'
                                    ? 'bg-amber-300/15 text-amber-200 border-amber-300/30'
                                    : 'bg-white/5 text-white/60 border-white/15'
                                const glyph =
                                  s === 'positive'
                                    ? '✓'
                                    : s === 'negative'
                                    ? '✗'
                                    : s === 'mixed'
                                    ? '±'
                                    : '−'
                                return (
                                  <span
                                    key={`s-${j}`}
                                    title={ctx ? `…${ctx}…` : `${s} mention`}
                                    className={`px-1.5 py-0.5 rounded border ${palette}`}
                                  >
                                    {glyph} {s}
                                  </span>
                                )
                              })}
                            </>
                          )}
                        </div>
                      )}
                      {c.status === 'success' && c.citations && c.citations.length > 0 && (
                        <ul className="space-y-0.5 mt-2">
                          {c.citations.slice(0, 6).map((url, j) => (
                            <li key={j} className="text-xs font-mono text-[#b4caff]/70 break-all">
                              <a href={url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                {url}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                      {c.status === 'error' && (
                        <p className="text-red-300 text-xs font-sans">{c.error}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </GlassCard>
  )
}

type SearchFilter = 'all' | 'on' | 'off'

function DashboardSection({ history }: { history: RunHistory[] }) {
  const [cityFilter, setCityFilter] = useState<string>('all')
  const [searchFilter, setSearchFilter] = useState<SearchFilter>('all')

  const cities = useMemo(() => {
    const set = new Set<string>()
    for (const h of history) if (h.city) set.add(h.city)
    return Array.from(set).sort()
  }, [history])

  // Detect whether the history actually contains both modes; controls whether
  // we show the dual-mode chart and the on/off toggle (no point if only
  // one mode has ever been run).
  const hasOn = useMemo(() => history.some((h) => h.searchEnabled === true), [history])
  const hasOff = useMemo(() => history.some((h) => h.searchEnabled === false), [history])
  const hasBothModes = hasOn && hasOff

  const scoped = useMemo(() => {
    let next = history
    if (cityFilter !== 'all') next = next.filter((h) => h.city === cityFilter)
    if (searchFilter === 'on') next = next.filter((h) => h.searchEnabled === true)
    else if (searchFilter === 'off') next = next.filter((h) => h.searchEnabled === false)
    return next
  }, [history, cityFilter, searchFilter])

  const total = scoped.length
  const errors = scoped.filter((h) => h.error).length
  const successful = total - errors
  const withMentions = scoped.filter((h) => !h.error && h.mentions > 0).length
  const totalMentions = scoped.reduce((s, h) => s + h.mentions, 0)
  const totalCost = scoped.reduce((s, h) => s + h.costUsd, 0)
  const mentionRate = successful > 0 ? Math.round((withMentions / successful) * 100) : 0

  // Sentiment breakdown across ALL match positions in scoped runs. Old
  // history entries without a sentiment array contribute their `mentions`
  // count as 'neutral' (since the classifier wasn't run for them).
  const sentimentTally = { positive: 0, neutral: 0, negative: 0, mixed: 0 }
  for (const h of scoped) {
    if (h.error) continue
    if (Array.isArray(h.sentiment) && h.sentiment.length > 0) {
      for (const s of h.sentiment) {
        if (s === 'positive') sentimentTally.positive++
        else if (s === 'negative') sentimentTally.negative++
        else if (s === 'mixed') sentimentTally.mixed++
        else sentimentTally.neutral++
      }
    } else if (h.mentions > 0) {
      sentimentTally.neutral += h.mentions
    }
  }
  const totalSentiment =
    sentimentTally.positive + sentimentTally.neutral + sentimentTally.negative + sentimentTally.mixed

  // Mean rank when mentioned: average of rank values across runs where a
  // structural rank was actually detected (not all mentioned runs — only
  // numbered/bulleted/ordinal-prose ones produce a numeric rank).
  const ranked = scoped.filter(
    (h) => !h.error && typeof h.rank === 'number' && h.rank !== null
  )
  const meanRank =
    ranked.length > 0
      ? ranked.reduce((s, h) => s + (h.rank || 0), 0) / ranked.length
      : null

  const byModel = new Map<
    string,
    { runs: number; mentions: number; cost: number; rankSum: number; rankCount: number }
  >()
  for (const h of scoped) {
    if (h.error) continue
    const k = h.modelName
    if (!byModel.has(k))
      byModel.set(k, { runs: 0, mentions: 0, cost: 0, rankSum: 0, rankCount: 0 })
    const m = byModel.get(k)!
    m.runs++
    if (h.mentions > 0) m.mentions++
    m.cost += h.costUsd
    if (typeof h.rank === 'number' && h.rank !== null) {
      m.rankSum += h.rank
      m.rankCount++
    }
  }
  const modelRows = Array.from(byModel.entries())
    .map(([name, v]) => ({
      name,
      ...v,
      rate: v.runs > 0 ? Math.round((v.mentions / v.runs) * 100) : 0,
      meanRank: v.rankCount > 0 ? v.rankSum / v.rankCount : null,
    }))
    .sort((a, b) => b.rate - a.rate || b.runs - a.runs)

  const byCity = new Map<string, { runs: number; mentions: number }>()
  for (const h of history) {
    if (h.error) continue
    const k = h.city || '(unknown)'
    if (!byCity.has(k)) byCity.set(k, { runs: 0, mentions: 0 })
    const v = byCity.get(k)!
    v.runs++
    if (h.mentions > 0) v.mentions++
  }
  const cityRows = Array.from(byCity.entries())
    .map(([name, v]) => ({ name, ...v, rate: v.runs > 0 ? Math.round((v.mentions / v.runs) * 100) : 0 }))
    .sort((a, b) => b.rate - a.rate || b.runs - a.runs)

  return (
    <GlassCard className="mb-6">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="font-serif text-xl text-[#b4caff] font-light">Dashboard</h2>
        <div className="flex items-center gap-3 flex-wrap">
          {hasBothModes && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-sans text-white/70 uppercase tracking-widest">Search</label>
              <div role="radiogroup" aria-label="Search-mode filter" className="flex rounded-lg border border-[color:var(--border)] overflow-hidden">
                {(['all', 'on', 'off'] as SearchFilter[]).map((opt) => {
                  const active = searchFilter === opt
                  return (
                    <button
                      key={opt}
                      role="radio"
                      aria-checked={active}
                      type="button"
                      onClick={() => setSearchFilter(opt)}
                      className={`px-3 py-1.5 text-xs font-sans uppercase tracking-widest transition-colors ${
                        active
                          ? 'bg-[#b4caff]/20 text-[#b4caff]'
                          : 'bg-[color:var(--surface)] text-white/60 hover:text-[#b4caff]'
                      }`}
                    >
                      {opt === 'all' ? 'All' : opt === 'on' ? 'On' : 'Off'}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {cities.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-sans text-white/70 uppercase tracking-widest">City</label>
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="bg-[color:var(--surface)] border border-[color:var(--border)] rounded-lg px-3 py-1.5 text-white text-sm font-sans"
              >
                <option value="all">All cities</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <DashStat label="Total runs" value={String(total)} />
        <DashStat label="Mention rate" value={`${mentionRate}%`} accent />
        <DashStat label="Total mentions" value={String(totalMentions)} />
        <DashStat label="Spent" value={`$${totalCost.toFixed(4)}`} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <DashStat
          label="Mean rank when mentioned"
          value={
            meanRank != null
              ? `${meanRank.toFixed(1)} (n=${ranked.length})`
              : '—'
          }
          accent={meanRank != null}
        />
        <DashStat
          label="Errors"
          value={errors > 0 ? `${errors} / ${total}` : '0'}
        />
      </div>

      {totalSentiment > 0 && (
        <div className="mb-5">
          <p className="text-xs text-white/70 uppercase tracking-widest font-sans mb-2">
            Sentiment breakdown · {totalSentiment} match{totalSentiment === 1 ? '' : 'es'}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <SentimentTile
              label="Positive"
              count={sentimentTally.positive}
              total={totalSentiment}
              palette="bg-emerald-400/15 border-emerald-400/40 text-emerald-300"
            />
            <SentimentTile
              label="Neutral"
              count={sentimentTally.neutral}
              total={totalSentiment}
              palette="bg-white/5 border-white/15 text-white/70"
            />
            <SentimentTile
              label="Negative"
              count={sentimentTally.negative}
              total={totalSentiment}
              palette="bg-red-400/15 border-red-400/40 text-red-300"
            />
            <SentimentTile
              label="Mixed"
              count={sentimentTally.mixed}
              total={totalSentiment}
              palette="bg-amber-300/15 border-amber-300/40 text-amber-200"
            />
          </div>
          <p className="text-[10px] text-white/40 font-sans mt-1">
            Rule-based heuristic; old history entries without a verdict count as neutral.
          </p>
        </div>
      )}

      <div className="mb-5">
        <p className="text-xs text-white/70 uppercase tracking-widest font-sans mb-2">
          Last 30 days · runs per day
          {searchFilter !== 'all' && (
            <span className="ml-2 text-[#b4caff]/70 normal-case tracking-normal">
              · search {searchFilter === 'on' ? 'ON only' : 'OFF only'}
            </span>
          )}
        </p>
        <DailyChart
          history={scoped}
          days={30}
          dualMode={hasBothModes && searchFilter === 'all'}
        />
        {hasBothModes && searchFilter === 'all' ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs font-sans">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-[#b4caff]" />
              <span className="text-white/70">search ON · mentioned</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-[#b4caff]/30" />
              <span className="text-white/70">search ON · no mention</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-amber-300" />
              <span className="text-white/70">search OFF · mentioned</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-amber-300/30" />
              <span className="text-white/70">search OFF · no mention</span>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-4 mt-2 text-xs font-sans">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-[#b4caff]" />
              <span className="text-white/70">runs that mentioned client</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-white/20" />
              <span className="text-white/70">runs without mention</span>
            </span>
          </div>
        )}
      </div>

      {cityFilter === 'all' && cityRows.length > 1 && (
        <div className="mb-5">
          <p className="text-xs text-white/70 uppercase tracking-widest font-sans mb-2">By city</p>
          <div className="divide-y divide-white/5">
            {cityRows.map((c) => (
              <div key={c.name} className="py-2 grid grid-cols-12 gap-3 items-center text-sm font-sans">
                <span className="col-span-5 text-white truncate">{c.name}</span>
                <div className="col-span-4 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-[#b4caff] rounded-full" style={{ width: `${c.rate}%` }} />
                </div>
                <span className="col-span-1 text-[#b4caff] text-right">{c.rate}%</span>
                <span className="col-span-2 text-white/60 text-right text-xs">
                  {c.mentions}/{c.runs}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {modelRows.length > 0 && (
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs text-white/70 uppercase tracking-widest font-sans">By model</p>
            <p className="text-[10px] text-white/50 uppercase tracking-widest font-sans">
              mention rate · mean rank
            </p>
          </div>
          <div className="divide-y divide-white/5">
            {modelRows.map((m) => (
              <div key={m.name} className="py-2 grid grid-cols-12 gap-3 items-center text-sm font-sans">
                <span className="col-span-4 text-white truncate">{m.name}</span>
                <div className="col-span-3 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-[#b4caff] rounded-full" style={{ width: `${m.rate}%` }} />
                </div>
                <span className="col-span-1 text-[#b4caff] text-right">{m.rate}%</span>
                <span
                  className="col-span-2 text-right text-xs font-mono"
                  title={
                    m.meanRank != null
                      ? `mean rank ${m.meanRank.toFixed(2)} across ${m.rankCount} ranked run${m.rankCount === 1 ? '' : 's'}`
                      : 'no ranked runs'
                  }
                >
                  {m.meanRank != null ? (
                    <span className="text-[#b4caff]">
                      #{m.meanRank.toFixed(1)}
                      <span className="text-white/40"> (n={m.rankCount})</span>
                    </span>
                  ) : (
                    <span className="text-white/30">—</span>
                  )}
                </span>
                <span className="col-span-2 text-white/60 text-right text-xs">
                  {m.mentions}/{m.runs} · ${m.cost.toFixed(3)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </GlassCard>
  )
}

function DashStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-[#b4caff]/5 border border-[#b4caff]/15 rounded-xl p-3">
      <div className={`text-2xl font-serif ${accent ? 'text-[#b4caff]' : 'text-white'}`}>{value}</div>
      <div className="text-white/70 text-xs font-sans uppercase tracking-widest mt-0.5">{label}</div>
    </div>
  )
}

function SentimentTile({
  label,
  count,
  total,
  palette,
}: {
  label: string
  count: number
  total: number
  palette: string
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className={`rounded-xl border p-3 ${palette}`}>
      <div className="text-2xl font-serif">{count}</div>
      <div className="text-xs font-sans uppercase tracking-widest mt-0.5 opacity-80">{label}</div>
      <div className="text-[10px] font-mono mt-0.5 opacity-60">{pct}%</div>
    </div>
  )
}

function DailyChart({
  history,
  days = 30,
  dualMode = false,
}: {
  history: RunHistory[]
  days?: number
  /** When true, render two side-by-side stacked bars per day (search ON / OFF). */
  dualMode?: boolean
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  type Bucket = {
    dateISO: string
    total: number
    mentions: number
    onTotal: number
    onMentions: number
    offTotal: number
    offMentions: number
  }
  const buckets: Bucket[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    buckets.push({
      dateISO: d.toISOString().slice(0, 10),
      total: 0,
      mentions: 0,
      onTotal: 0,
      onMentions: 0,
      offTotal: 0,
      offMentions: 0,
    })
  }
  for (const h of history) {
    if (h.error) continue
    const iso = new Date(h.ts).toISOString().slice(0, 10)
    const b = buckets.find((x) => x.dateISO === iso)
    if (!b) continue
    b.total++
    if (h.mentions > 0) b.mentions++
    if (h.searchEnabled) {
      b.onTotal++
      if (h.mentions > 0) b.onMentions++
    } else {
      b.offTotal++
      if (h.mentions > 0) b.offMentions++
    }
  }

  // Bar height scale: in dual mode each sub-bar is normalized to the
  // largest single-mode count, so an asymmetric day (e.g. lots of ON, few
  // OFF) doesn't make the OFF column visually disappear.
  const max = dualMode
    ? Math.max(1, ...buckets.flatMap((b) => [b.onTotal, b.offTotal]))
    : Math.max(1, ...buckets.map((b) => b.total))

  const W = 600
  const H = 160
  const PAD_X = 12
  const PAD_BOTTOM = 22
  const PAD_TOP = 8
  const chartH = H - PAD_BOTTOM - PAD_TOP
  const barSlot = (W - PAD_X * 2) / days
  // Single mode: one fat bar per slot. Dual mode: two narrow bars + a 1px
  // gap so eye separates them.
  const barW = dualMode ? Math.max(2, (barSlot - 4) / 2) : Math.max(2, barSlot - 2)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-44">
      {[0.25, 0.5, 0.75, 1].map((f) => {
        const y = PAD_TOP + chartH * (1 - f)
        return (
          <line
            key={f}
            x1={PAD_X}
            x2={W - PAD_X}
            y1={y}
            y2={y}
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="2 4"
          />
        )
      })}
      {buckets.map((b, i) => {
        if (dualMode) {
          if (b.onTotal === 0 && b.offTotal === 0) return null
          const slotX = PAD_X + i * barSlot
          const onX = slotX + (barSlot - (barW * 2 + 2)) / 2
          const offX = onX + barW + 2

          const onTotalH = chartH * (b.onTotal / max)
          const onMentH = onTotalH * (b.onTotal > 0 ? b.onMentions / b.onTotal : 0)
          const yOnTotalTop = PAD_TOP + chartH - onTotalH
          const yOnMentTop = PAD_TOP + chartH - onMentH

          const offTotalH = chartH * (b.offTotal / max)
          const offMentH = offTotalH * (b.offTotal > 0 ? b.offMentions / b.offTotal : 0)
          const yOffTotalTop = PAD_TOP + chartH - offTotalH
          const yOffMentTop = PAD_TOP + chartH - offMentH

          return (
            <g key={b.dateISO}>
              {b.onTotal > 0 && (
                <>
                  <rect x={onX} y={yOnTotalTop} width={barW} height={onTotalH - onMentH} fill="rgba(180,202,255,0.30)" rx={1} />
                  <rect x={onX} y={yOnMentTop} width={barW} height={onMentH} fill="#b4caff" rx={1} />
                </>
              )}
              {b.offTotal > 0 && (
                <>
                  <rect x={offX} y={yOffTotalTop} width={barW} height={offTotalH - offMentH} fill="rgba(252,211,77,0.30)" rx={1} />
                  <rect x={offX} y={yOffMentTop} width={barW} height={offMentH} fill="#fcd34d" rx={1} />
                </>
              )}
            </g>
          )
        }

        if (b.total === 0) return null
        const x = PAD_X + i * barSlot + (barSlot - barW) / 2
        const totalH = chartH * (b.total / max)
        const mentH = totalH * (b.mentions / Math.max(1, b.total))
        const yTotalTop = PAD_TOP + chartH - totalH
        const yMentTop = PAD_TOP + chartH - mentH
        return (
          <g key={b.dateISO}>
            <rect x={x} y={yTotalTop} width={barW} height={totalH - mentH} fill="rgba(255,255,255,0.20)" rx={1} />
            <rect x={x} y={yMentTop} width={barW} height={mentH} fill="#b4caff" rx={1} />
          </g>
        )
      })}
      {buckets.map((b, i) => {
        if (i % 5 !== 0 && i !== buckets.length - 1) return null
        const x = PAD_X + i * barSlot + barSlot / 2
        const label = b.dateISO.slice(5).replace('-', '/')
        return (
          <text
            key={b.dateISO}
            x={x}
            y={H - 6}
            fill="rgba(255,255,255,0.55)"
            fontSize={10}
            textAnchor="middle"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          >
            {label}
          </text>
        )
      })}
    </svg>
  )
}
