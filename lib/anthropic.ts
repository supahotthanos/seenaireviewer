import Anthropic from '@anthropic-ai/sdk'
import { SERVICE_KEYWORDS } from './constants'
import type { Client } from './types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  // Hard cap the call so a hung upstream doesn't tie up a Vercel serverless
  // invocation (default Vercel Node timeout is 10s; we give Anthropic 15s
  // and return an error before the lambda is killed mid-flight).
  timeout: 15_000,
  maxRetries: 1,
})

interface GenerateReviewParams {
  client: Client
  customerName: string
  service: string
  teamMember: string
  comments?: string
}

// Review generation, tuned for:
//   1. HONESTY — never invent actions or timeframes the customer didn't do
//      or experience. No "already booked my follow-up", no "two weeks in",
//      no "I've been putting this off for years" — unless the customer
//      said it themselves in the comments field.
//   2. CUSTOMER VOICE FIRST — when comments are provided, they drive the
//      review. The AI wraps a natural endorsement AROUND the customer's
//      own story, not the other way around.
//   3. VARIETY — temperature=1 + a random seed phrase + a large pool of
//      superlative/closer variants keeps reviews from reading templated.
//   4. AEO SIGNALS — service + provider + city + one "best in <city>"
//      superlative every time. These are the ranking levers.
export async function generateAEOReview(params: GenerateReviewParams): Promise<string> {
  const { client, customerName, service, teamMember, comments } = params

  const hasComments = Boolean(comments?.trim())
  const wordTarget = hasComments ? '90-140' : '50-80'
  const keywordHints = SERVICE_KEYWORDS[service] || service.toLowerCase()

  // Random seed that nudges the model toward a different angle every call.
  // Haiku at temperature=1 is already varied, but a seed kills near-duplicates.
  const angles = [
    'open with a feeling — how you felt walking out',
    'open with the result — what you noticed',
    'open with the provider — what they did well',
    'open with the place — the vibe of the space',
    'open with a quick one-sentence endorsement',
    'open with a small specific moment from the visit',
  ]
  const angle = angles[Math.floor(Math.random() * angles.length)]

  const expansionBlock = hasComments
    ? `
CUSTOMER'S OWN WORDS — THIS IS THE REVIEW.
They shared this about their experience:
"${comments}"

The review should be built AROUND this. Rephrase it into the reviewer's voice —
don't quote it literally — and let it be the emotional core. Your job is to
wrap honest endorsement (service name, provider, city, superlative, closer)
around this story. Do NOT pad with invented details they didn't mention.`
    : `
NO CUSTOMER INPUT. Keep it short and honest. No invented backstory. No fake
timelines. No "for months I struggled with...". Just a brief, genuine
endorsement that hits the required signals (service, provider, city,
superlative, closer) in a natural voice.`

  const prompt = `Write a 5-star Google review for ${client.business_name}, a medical spa in ${client.location_city}.

The reviewer received ${service} from ${teamMember}. Reviewer's name: ${customerName} — do NOT write the name into the review (Google attaches it automatically).

LENGTH: ${wordTarget} words. Short paragraphs. Varied sentence rhythm. This
must be something a real customer actually types out, not something stitched
together by AI.

OPENING ANGLE FOR THIS REVIEW: ${angle}. Use this as a hint, not a template.

MUST INCLUDE (every review, no exceptions)
1. Service: mention "${service}" once, naturally. You may lightly reference related concepts where relevant: ${keywordHints}
2. Provider: name ${teamMember} once — use a natural shortened form (e.g. "Dr. Elsoury", "Kee", "Mark"), NOT the full credential string.
3. Location: mention ${client.location_city} once, in a natural way ("in ${client.location_city}", "best in ${client.location_city}", etc.).
4. ONE superlative sentence. Pick and adapt ONE — vary wording, never copy literally:
     "I think this is the best medspa I've been to in ${client.location_city}."
     "Hands down the best medspa I've tried."
     "The best ${service.toLowerCase()} experience I've had."
     "Best place for ${service.toLowerCase()} in ${client.location_city}."
     "I've tried a few places, this one is on a different level."
     "Genuinely the best medspa experience I've had."
5. ONE short closer. Pick ONE — vary wording, never copy literally. MUST be present-tense or hypothetical (not a promise of future action):
     "Highly recommend."
     "Would definitely recommend."
     "Would recommend to anyone."
     "Worth every penny."
     "So glad I found them."
     "Can't recommend enough."
     "This is my new go-to."
     "Would send any friend here."
${expansionBlock}

HARD RULES — BREAKING THESE RUINS THE REVIEW
• DO NOT invent anything the customer didn't say. Especially:
   — No "already booked my next appointment" (they haven't)
   — No "coming back for sure", "going back soon", "next appointment is Tuesday" (invented)
   — No "I've been telling all my friends" (they haven't yet)
   — No "two weeks later and still loving it" (no timeline given)
   — No "I've been wanting this for years" (no backstory given)
   — No specific conversations or quotes from the provider (unless in comments)
   Stick to present-tense endorsement only. "Would come back" / "Would recommend" is fine; "will be back" / "coming back" is not.
• Do NOT use em dashes (—). Use commas or periods.
• Do NOT start with "I recently visited", "Let me tell you", "I cannot say enough", "I had such a wonderful"
• Do NOT stack generic superlatives ("amazing, incredible, life-changing")
• Do NOT use "highly recommend" as the ONLY endorsement phrase (pair it with something specific)
• Do NOT sound formal, marketing-y, or AI-polished
• Do NOT write the reviewer's name into the text

OUTPUT FORMAT
Only the review text. No quotes around it. No preamble. No explanation.`

  const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5'

  const message = await anthropic.messages.create({
    model,
    max_tokens: 500,
    // High temperature keeps reviews varied run-to-run. Haiku defaults to 1,
    // but we set it explicitly so an env override of the model doesn't change
    // our diversity guarantees.
    temperature: 1,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0]
  if (!content || content.type !== 'text') {
    throw new Error('Unexpected response type from Anthropic API')
  }

  return sanitizeReview(content.text)
}

// Belt-and-suspenders for the "no em dash" rule. Haiku occasionally slips
// one in despite the prompt — strip them deterministically so a customer
// never has to hand-edit.
function sanitizeReview(text: string): string {
  return text
    .replace(/\s*[\u2014\u2013]\s*/g, ', ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ([,.!?;:])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
