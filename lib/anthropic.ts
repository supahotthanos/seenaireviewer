import Anthropic from '@anthropic-ai/sdk'
import { SERVICE_KEYWORDS } from './constants'
import type { Client } from './types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface GenerateReviewParams {
  client: Client
  customerName: string
  service: string
  teamMember: string
  comments?: string
}

export async function generateAEOReview(params: GenerateReviewParams): Promise<string> {
  const { client, customerName, service, teamMember, comments } = params

  const keywords = SERVICE_KEYWORDS[service] || service.toLowerCase()
  const commentsSection = comments?.trim()
    ? `\n\nCustomer's own words (incorporate naturally, don't quote directly): "${comments}"`
    : ''

  const prompt = `You are writing a genuine Google review for ${client.business_name}, a medical spa located at ${client.location_address || client.location_city}.

Write a 5-star Google review from the perspective of a real customer named ${customerName} who received ${service} treatment from ${teamMember}.

Requirements:
- 150-250 words (this is critical for SEO)
- Write in first person as ${customerName}
- Naturally include these keywords: ${keywords}
- Mention ${teamMember} by name and describe their professionalism/expertise
- Reference the ${client.location_city} location naturally (not forced)
- Include specific, outcome-focused language ("I finally feel...", "The results were...", "I noticed...")
- Sound authentic and personal — NOT like AI or a generic template
- Avoid clichés: "highly recommend" alone, "five stars", "amazing experience" without context
- Do NOT use em dashes (—) or overly formal language
- Do NOT start with "I recently visited" or similar stock phrases
- End with a specific reason why you'd return or recommend it${commentsSection}

Return ONLY the review text. No preamble, no quotes, no explanation.`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Anthropic API')
  }

  return content.text.trim()
}
