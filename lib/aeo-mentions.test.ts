// Manual test runner for the AEO mention/rank detectors.
// Run: `npm run test:aeo` (uses tsx).
//
// No test framework dependency — just plain assertions written as functions.
// Each case feeds a representative LLM-style response into extractRank +
// countMentions and prints a compact PASS/FAIL line.

import { countMentions, extractRank, deriveAliases } from './aeo-mentions'

interface Case {
  name: string
  text: string
  aliases: string[]
  // Expected mention count (deduped) + which format/rank/total we expect.
  expect: {
    mentions: number
    rank: number | null
    totalItems: number | null
    format: 'numbered' | 'bullet' | 'prose' | 'unknown'
  }
}

const ALIASES = deriveAliases('LovMedSpa')

const CASES: Case[] = [
  {
    name: 'numbered list, brand at #2',
    text: `Here are the best med spas in Brooklyn:

1. Glow Aesthetics — known for HydraFacial.
2. LovMedSpa — top-rated for Botox.
3. Some Other Spa.`,
    aliases: ALIASES,
    expect: { mentions: 1, rank: 2, totalItems: 3, format: 'numbered' },
  },
  {
    name: 'numbered list with multi-line descriptions, brand at #3',
    text: `Top picks:

1. Glow Aesthetics
   Excellent injectors and friendly staff.

2. Other Spa
   Specializes in laser treatments.

3. LovMedSpa
   Known for natural-looking results and personalized care.`,
    aliases: ALIASES,
    expect: { mentions: 1, rank: 3, totalItems: 3, format: 'numbered' },
  },
  {
    name: 'numbered list with ")" delimiter',
    text: `1) Glow Aesthetics
2) LovMedSpa
3) Other Spa`,
    aliases: ALIASES,
    expect: { mentions: 1, rank: 2, totalItems: 3, format: 'numbered' },
  },
  {
    name: 'bulleted list with -, brand at #1',
    text: `Top medspas:
- LovMedSpa
- Glow Aesthetics
- Other Spa`,
    aliases: ALIASES,
    expect: { mentions: 1, rank: 1, totalItems: 3, format: 'bullet' },
  },
  {
    name: 'bulleted list with •, brand at #4',
    text: `Recommended places:
• Glow
• Other Spa
• Yet Another
• Lov MedSpa
• One More`,
    aliases: ALIASES,
    expect: { mentions: 1, rank: 4, totalItems: 5, format: 'bullet' },
  },
  {
    name: 'prose ordinals "first/second/third"',
    text:
      'There are several great options. The first is Glow Aesthetics, ' +
      'with excellent reviews. The second is LovMedSpa, which specializes ' +
      'in natural-looking results. The third is another local favorite.',
    aliases: ALIASES,
    expect: { mentions: 1, rank: 2, totalItems: 3, format: 'prose' },
  },
  {
    name: 'prose ordinals "1st/2nd/3rd"',
    text:
      'My 1st pick would be Glow Aesthetics. My 2nd is Other Spa. My 3rd ' +
      'recommendation is LovMedSpa for anyone wanting personalized care.',
    aliases: ALIASES,
    expect: { mentions: 1, rank: 3, totalItems: 3, format: 'prose' },
  },
  {
    name: 'prose without ordinals, brand mentioned (fallback)',
    text:
      'LovMedSpa is one of the best medspas in Brooklyn. It is known for ' +
      'high-quality treatments and a comfortable atmosphere.',
    aliases: ALIASES,
    expect: { mentions: 1, rank: null, totalItems: null, format: 'prose' },
  },
  {
    name: 'brand not in text → unknown',
    text: 'The best medspas in Brooklyn include Glow Aesthetics and Other Spa.',
    aliases: ALIASES,
    expect: { mentions: 0, rank: null, totalItems: null, format: 'unknown' },
  },
  {
    name: 'numbered list takes priority over prose mention',
    text: `Some background: LovMedSpa is highly regarded among many clinics.
Here is the official ranking:

1. Glow Aesthetics
2. LovMedSpa
3. Yet Another Spa`,
    aliases: ALIASES,
    expect: { mentions: 2, rank: 2, totalItems: 3, format: 'numbered' },
  },
]

function runTests() {
  let pass = 0
  let fail = 0
  const failures: string[] = []

  for (const c of CASES) {
    const mentionResult = countMentions(c.text, c.aliases)
    const rankResult = extractRank(c.text, mentionResult.matches)

    const errs: string[] = []
    if (mentionResult.count !== c.expect.mentions) {
      errs.push(`mentions: expected ${c.expect.mentions}, got ${mentionResult.count}`)
    }
    if (rankResult.rank !== c.expect.rank) {
      errs.push(`rank: expected ${c.expect.rank}, got ${rankResult.rank}`)
    }
    if (rankResult.totalItems !== c.expect.totalItems) {
      errs.push(`totalItems: expected ${c.expect.totalItems}, got ${rankResult.totalItems}`)
    }
    if (rankResult.format !== c.expect.format) {
      errs.push(`format: expected ${c.expect.format}, got ${rankResult.format}`)
    }

    if (errs.length === 0) {
      pass++
      console.log(`  ✓ ${c.name}`)
    } else {
      fail++
      failures.push(`✗ ${c.name}\n    ${errs.join('\n    ')}`)
      console.log(`  ✗ ${c.name}`)
      for (const e of errs) console.log(`      ${e}`)
    }
  }

  console.log()
  console.log(`  ${pass}/${CASES.length} passed`)
  if (fail > 0) {
    console.log()
    console.log(failures.join('\n'))
    process.exit(1)
  }
}

runTests()
