// Mention detection for the AEO ranking tester.
//
// The naive `text.includes(businessName)` approach breaks on every realistic
// model output: "LovMedSpa" doesn't match "Lov MedSpa", "Lov Med Spa",
// "LovMedSpa's", "lovmedspa", or any combination thereof. This module:
//
//   1. Normalizes both the response text and the alias list (lowercase,
//      strip punctuation except internal apostrophes, collapse whitespace).
//   2. Derives sensible aliases from the canonical name automatically when
//      the operator hasn't supplied a custom list — CamelCase splits,
//      possessive ("X's"), plural ("Xs").
//   3. Finds all alias occurrences and DEDUPES overlapping matches by
//      position (so "LovMedSpa" and "Lov" both inside the same span count
//      once, with the longer alias winning).
//   4. Returns both the count of distinct mentions AND the unique surface
//      forms found, so the UI can show "the model spelled it 'Lov MedSpa'"
//      instead of just "1 mention."

export interface MentionResult {
  /** Number of distinct (non-overlapping) mention positions. */
  count: number
  /** Unique alias surface forms that actually matched in the text. */
  matches: string[]
  /**
   * One hit per non-overlapping match position. Carries the alias surface
   * form actually matched plus the start char index in the ORIGINAL text
   * (not the normalized text), so downstream analyzers like the sentiment
   * classifier can grab a context window around each match.
   */
  hits: { surface: string; position: number }[]
}

/**
 * Normalize a string for comparison.
 *   - lowercase
 *   - keep apostrophes (so "LovMedSpa's" survives), strip other punctuation
 *   - collapse whitespace runs to single spaces
 */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9'\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Generate a sensible alias list from a canonical business name.
 * "LovMedSpa" → ["LovMedSpa", "Lov MedSpa", "Lov Med Spa",
 *                "LovMedSpa's", "Lov MedSpa's", "Lov Med Spa's",
 *                "LovMedSpas", "Lov MedSpas", "Lov Med Spas"]
 *
 * "Glow Aesthetics" → ["Glow Aesthetics", "Glow Aesthetics's"]
 *  (no plural — already ends in "s"; full-word names don't get camel-split)
 */
export function deriveAliases(canonical: string): string[] {
  const trimmed = (canonical || '').trim()
  if (!trimmed) return []

  const out = new Set<string>()
  out.add(trimmed)

  // Full CamelCase split: insert a space before every capital that follows
  // a lowercase letter. "LovMedSpa" → "Lov Med Spa".
  const fullSplit = trimmed.replace(/([a-z])([A-Z])/g, '$1 $2')
  if (fullSplit !== trimmed) out.add(fullSplit)

  // Partial split: just one space at the first capital boundary.
  // "LovMedSpa" → "Lov MedSpa".
  const partialMatch = trimmed.match(/^([A-Z][a-z]+)([A-Z].*)$/)
  if (partialMatch) out.add(`${partialMatch[1]} ${partialMatch[2]}`)

  // For each variant collected so far, add possessive + plural where safe.
  for (const v of Array.from(out)) {
    out.add(`${v}'s`)
    // Skip plural if the name already ends in s/x/z/ch/sh — would need
    // "es" suffix which is rare in real text and risks false matches.
    if (!/[sxz]$/i.test(v) && !/[cs]h$/i.test(v)) {
      out.add(`${v}s`)
    }
  }

  return Array.from(out)
}

/**
 * Count distinct, non-overlapping alias occurrences in `text`.
 * When two aliases would match the same span, the longer one wins (so
 * "LovMedSpa" inside the response doesn't get double-counted as "Lov" +
 * "LovMedSpa").
 *
 * Matches against the ORIGINAL text (case-insensitive) so each hit carries
 * its original-text position — required by the sentiment classifier and
 * any downstream consumer that needs to grab a context window around the
 * match. Punctuation variants like "Lov-MedSpa" lose to this approach
 * (the normalize-then-match path used to catch them); judgment call:
 * deriveAliases already covers the high-frequency variants and operators
 * can add the rare ones to the alias list.
 *
 * Returns count, the unique surface forms that matched, and a per-position
 * hits array.
 */
export function countMentions(text: string, aliases: string[]): MentionResult {
  if (!text || !aliases || aliases.length === 0) {
    return { count: 0, matches: [], hits: [] }
  }

  const lowerText = text.toLowerCase()

  type Raw = { start: number; end: number; alias: string }
  const raw: Raw[] = []

  for (const alias of aliases) {
    const trimmed = (alias || '').trim()
    if (!trimmed) continue
    const lowerAlias = trimmed.toLowerCase()
    let pos = 0
    while ((pos = lowerText.indexOf(lowerAlias, pos)) !== -1) {
      // Word-boundary-ish guard: don't match alias inside a longer word
      // (so "spa" doesn't match inside "spahetti"). Apostrophe + digit
      // count as word chars; whitespace + punctuation are boundaries.
      const before = pos === 0 ? ' ' : lowerText[pos - 1]
      const after =
        pos + lowerAlias.length >= lowerText.length ? ' ' : lowerText[pos + lowerAlias.length]
      const isWordChar = (ch: string) => /[a-z0-9']/.test(ch)
      if (!isWordChar(before) && !isWordChar(after)) {
        raw.push({ start: pos, end: pos + lowerAlias.length, alias: trimmed })
      }
      pos += lowerAlias.length
    }
  }

  if (raw.length === 0) return { count: 0, matches: [], hits: [] }

  // Sort ascending start, descending length so longer-alias-at-same-start
  // wins the dedupe pass.
  raw.sort((a, b) => a.start - b.start || b.end - a.end)

  const merged: Raw[] = []
  for (const h of raw) {
    const last = merged[merged.length - 1]
    if (last && h.start < last.end) continue
    merged.push(h)
  }

  const matchSet = new Set<string>()
  for (const h of merged) matchSet.add(h.alias)

  return {
    count: merged.length,
    matches: Array.from(matchSet),
    hits: merged.map((h) => ({
      surface: text.slice(h.start, h.end),
      position: h.start,
    })),
  }
}

/**
 * Build a regex that highlights ANY alias variant in raw response text.
 * Used by the UI to <mark> all spellings the model used. Returns null if
 * the alias list is empty so the caller can short-circuit.
 */
export function buildHighlightRegex(aliases: string[]): RegExp | null {
  const cleaned = aliases.map((a) => a.trim()).filter(Boolean)
  if (cleaned.length === 0) return null
  // Escape regex specials. Sort longest-first so alternation prefers
  // longer matches (regex alternation is left-priority).
  cleaned.sort((a, b) => b.length - a.length)
  const escaped = cleaned.map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`(${escaped.join('|')})`, 'gi')
}

// ──────────────────────────────────────────────────────────────────────
// Rank extraction
// ──────────────────────────────────────────────────────────────────────
//
// "Was the brand mentioned?" is half the AEO signal. The other half is
// "where in the response?" — being #1 in a top-10 list is fundamentally
// different from being #9. extractRank tries three structural detectors
// in priority order and falls back to prose when nothing structural fits.

export type RankFormat = 'numbered' | 'bullet' | 'prose' | 'unknown'

export interface RankResult {
  /** 1-indexed position; null when no list structure is detected. */
  rank: number | null
  /** Total items in the detected list; null for prose / no list. */
  totalItems: number | null
  /** Which detector produced the result. */
  format: RankFormat
}

const ORDINAL_WORDS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
  sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  '1st': 1, '2nd': 2, '3rd': 3, '4th': 4, '5th': 5,
  '6th': 6, '7th': 7, '8th': 8, '9th': 9, '10th': 10,
}

const ORDINAL_REGEX =
  /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|1st|2nd|3rd|4th|5th|6th|7th|8th|9th|10th)\b/gi

/** All character positions where any of the matched aliases appear in text. */
function findAliasPositions(text: string, aliasMatches: string[]): number[] {
  const lowerText = text.toLowerCase()
  const positions: number[] = []
  for (const alias of aliasMatches) {
    const lowerAlias = alias.toLowerCase()
    if (!lowerAlias) continue
    let pos = 0
    while ((pos = lowerText.indexOf(lowerAlias, pos)) !== -1) {
      positions.push(pos)
      pos += lowerAlias.length
    }
  }
  positions.sort((a, b) => a - b)
  return positions
}

/**
 * Numbered list detector. Lines like "1. Foo" or "2) Bar" delimit items;
 * the alias's rank is the captured number on the line whose region
 * contains the alias position. When the alias appears in multiple list
 * items, the smallest (highest-priority) rank wins.
 */
function detectNumbered(text: string, aliasPositions: number[]): RankResult | null {
  const lines = text.split('\n')
  type NL = { charPos: number; number: number }
  const numbered: NL[] = []
  let charPos = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m = line.match(/^\s*(\d+)[.)]\s+/)
    if (m) numbered.push({ charPos, number: parseInt(m[1], 10) })
    charPos += line.length + 1 // +1 for the newline char
  }
  if (numbered.length < 2) return null

  let bestRank: number | null = null
  for (const aliasPos of aliasPositions) {
    for (let i = 0; i < numbered.length; i++) {
      const start = numbered[i].charPos
      const end = i + 1 < numbered.length ? numbered[i + 1].charPos : text.length
      if (aliasPos >= start && aliasPos < end) {
        if (bestRank === null || numbered[i].number < bestRank) {
          bestRank = numbered[i].number
        }
        break // each alias position lives in at most one region
      }
    }
  }

  if (bestRank === null) return null
  // totalItems = highest captured number (handles non-contiguous lists too)
  const totalItems = numbered.reduce((max, n) => Math.max(max, n.number), 0)
  return { rank: bestRank, totalItems, format: 'numbered' }
}

/**
 * Bulleted list detector. Lines starting with -, *, or • are treated as
 * one-indexed positional items (we count their order, not any number on
 * the line). Smallest ordinal wins on multi-mention.
 */
function detectBulleted(text: string, aliasPositions: number[]): RankResult | null {
  const lines = text.split('\n')
  type BL = { charPos: number; ordinal: number }
  const bullets: BL[] = []
  let charPos = 0
  let ordinal = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*[-*•]\s+/.test(line)) {
      ordinal++
      bullets.push({ charPos, ordinal })
    }
    charPos += line.length + 1
  }
  if (bullets.length < 2) return null

  let best: number | null = null
  for (const aliasPos of aliasPositions) {
    for (let i = 0; i < bullets.length; i++) {
      const start = bullets[i].charPos
      const end = i + 1 < bullets.length ? bullets[i + 1].charPos : text.length
      if (aliasPos >= start && aliasPos < end) {
        if (best === null || bullets[i].ordinal < best) best = bullets[i].ordinal
        break
      }
    }
  }
  if (best === null) return null
  return { rank: best, totalItems: bullets.length, format: 'bullet' }
}

/**
 * Prose ordinal detector. Looks for "first", "second", ... "tenth" (and
 * "1st", "2nd", ...) in running text. The alias's rank is the value of
 * the nearest ordinal that PRECEDES it. Smallest rank wins on multi-mention.
 */
function detectProseOrdinals(text: string, aliasPositions: number[]): RankResult | null {
  const ordinals: { pos: number; value: number }[] = []
  ORDINAL_REGEX.lastIndex = 0 // global regex state guard
  let m: RegExpExecArray | null
  while ((m = ORDINAL_REGEX.exec(text)) !== null) {
    const word = m[1].toLowerCase()
    const value = ORDINAL_WORDS[word]
    if (value !== undefined) ordinals.push({ pos: m.index, value })
  }
  if (ordinals.length < 2) return null

  let best: number | null = null
  for (const aliasPos of aliasPositions) {
    for (let i = ordinals.length - 1; i >= 0; i--) {
      if (ordinals[i].pos < aliasPos) {
        if (best === null || ordinals[i].value < best) best = ordinals[i].value
        break
      }
    }
  }
  if (best === null) return null
  const totalItems = ordinals.reduce((max, o) => Math.max(max, o.value), 0)
  return { rank: best, totalItems, format: 'prose' }
}

// ──────────────────────────────────────────────────────────────────────
// Sentiment classification (rule-based)
// ──────────────────────────────────────────────────────────────────────
//
// AEO mention rate alone is misleading: "avoid LovMedSpa" counts the same
// as "LovMedSpa is excellent" today. classifyMentionSentiment looks at a
// small window around each match and labels it with a coarse verdict so
// the dashboard can show "47 mentions: 38 pos / 7 neut / 2 neg".
//
// TODO(v2): swap the rule-based scanner for a cheap LLM call (claude-haiku-4-5
// or gpt-5.4-nano at ~$0.0001/call). Heuristics here trade recall for cost
// + determinism — good enough for ranking signal, blind to sarcasm and
// indirect criticism ("their pricing is interesting…").

export type Sentiment = 'positive' | 'neutral' | 'negative' | 'mixed'

/** Window radius in characters extracted around each match for analysis. */
const SENTIMENT_WINDOW = 150

const POSITIVE_CUES = [
  'top-rated', 'top rated', 'best', 'recommended', 'highly recommend',
  'highly recommended', 'highly', 'excellent', 'leading', 'premier',
  'trusted', 'amazing', 'fantastic', 'great', 'professional', 'clean',
  'friendly', 'expert', 'experts', 'reputable', 'renowned', 'acclaimed',
  'award-winning', 'award winning', 'standout', 'outstanding', 'must-visit',
  'must visit', 'go-to', 'go to', 'favorite', 'favourite', 'loved',
  'beloved', 'popular', 'praised', 'beautiful', 'luxurious', 'caring',
  'knowledgeable', 'attentive', 'skilled',
]

const NEGATIVE_CUES = [
  'avoid', 'stay away', 'not recommended', 'do not recommend',
  "don't recommend", "wouldn't recommend", 'complaints', 'complaint',
  'lawsuit', 'overpriced', 'scam', 'warning', 'terrible', 'awful', 'bad',
  'poor', 'disappointed', 'disappointing', 'rude', 'unprofessional',
  'dirty', 'worst', 'shady', 'sketchy', 'horrible', 'rip-off', 'ripoff',
  'misleading', 'fake', 'unsafe', 'botched', 'sued', 'controversial',
  'unethical', 'unsanitary', 'unhygienic',
]

// Negation reversers — a positive cue inside one of these clauses flips
// to negative. Cheap heuristic: if any reverser appears within ~25 chars
// BEFORE a positive cue we treat the cue as negated.
const NEGATION_REVERSERS = [
  'not', "isn't", "aren't", "wasn't", "weren't", "doesn't", "don't",
  "didn't", "won't", "wouldn't", "shouldn't", "can't", 'never', 'no',
  'avoid', 'hardly', 'barely',
]
const NEGATION_LOOKBEHIND = 25

function findCueAt(haystack: string, cue: string): number[] {
  // Word-boundary match. Multi-word cues use a relaxed boundary on the
  // outer edges only (interior whitespace is preserved as-is).
  const escaped = cue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`(?:^|[^a-z0-9'])${escaped}(?:$|[^a-z0-9'])`, 'gi')
  const positions: number[] = []
  let m: RegExpExecArray | null
  while ((m = pattern.exec(haystack)) !== null) {
    positions.push(m.index + (m[0].toLowerCase().startsWith(cue.toLowerCase()) ? 0 : 1))
    // Avoid zero-length match infinite loop
    if (m.index === pattern.lastIndex) pattern.lastIndex++
  }
  return positions
}

/**
 * Classify sentiment around a single match position.
 *   - positive: positive cues fire and no negation reversers precede them
 *   - negative: negative cues fire OR a positive cue is preceded by negation
 *   - neutral: nothing fires
 *   - mixed: both sides fire independently
 */
export function classifyMentionSentiment(
  text: string,
  matchPosition: number,
  windowChars: number = SENTIMENT_WINDOW
): { sentiment: Sentiment; context: string } {
  if (!text || matchPosition < 0) return { sentiment: 'neutral', context: '' }
  const start = Math.max(0, matchPosition - windowChars)
  const end = Math.min(text.length, matchPosition + windowChars)
  const window = text.slice(start, end)
  const lower = window.toLowerCase()

  let posScore = 0
  let negScore = 0

  for (const cue of POSITIVE_CUES) {
    const hits = findCueAt(lower, cue)
    for (const at of hits) {
      // Negation lookbehind: scan ~25 chars before the cue for any reverser.
      const lbStart = Math.max(0, at - NEGATION_LOOKBEHIND)
      const lookbehind = lower.slice(lbStart, at)
      const negated = NEGATION_REVERSERS.some((r) =>
        new RegExp(`(?:^|[^a-z0-9'])${r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^a-z0-9'])`).test(
          lookbehind
        )
      )
      if (negated) negScore++
      else posScore++
    }
  }
  for (const cue of NEGATIVE_CUES) {
    if (findCueAt(lower, cue).length > 0) negScore++
  }

  let sentiment: Sentiment = 'neutral'
  if (posScore > 0 && negScore > 0) sentiment = 'mixed'
  else if (posScore > 0) sentiment = 'positive'
  else if (negScore > 0) sentiment = 'negative'

  return { sentiment, context: window.trim() }
}

/**
 * Run the classifier across every hit returned by countMentions. Result
 * arrays are positional (index N is the verdict + context for hit N).
 */
export function classifyAllMentions(
  text: string,
  hits: { position: number }[]
): { sentiments: Sentiment[]; contexts: string[] } {
  const sentiments: Sentiment[] = []
  const contexts: string[] = []
  for (const h of hits) {
    const r = classifyMentionSentiment(text, h.position)
    sentiments.push(r.sentiment)
    contexts.push(r.context)
  }
  return { sentiments, contexts }
}

/**
 * Best-effort rank extraction.
 *   - Returns format='unknown' + rank=null when no alias appears at all.
 *   - Returns format='prose' + rank=null when alias appears but no
 *     numbered, bulleted, or ordinal list structure could be matched.
 *   - Otherwise returns the smallest rank the alias can be associated with
 *     in the highest-priority detected structure.
 */
export function extractRank(text: string, aliasMatches: string[]): RankResult {
  if (!text || !aliasMatches || aliasMatches.length === 0) {
    return { rank: null, totalItems: null, format: 'unknown' }
  }
  const positions = findAliasPositions(text, aliasMatches)
  if (positions.length === 0) {
    return { rank: null, totalItems: null, format: 'unknown' }
  }

  // Priority order: numbered → bulleted → prose ordinals → fallback prose
  const numbered = detectNumbered(text, positions)
  if (numbered) return numbered

  const bulleted = detectBulleted(text, positions)
  if (bulleted) return bulleted

  const prose = detectProseOrdinals(text, positions)
  if (prose) return prose

  return { rank: null, totalItems: null, format: 'prose' }
}
