import { z } from 'zod'
import { LIMITS } from './constants'

// Generate review (positive path) — called from /api/generate-review
export const generateReviewSchema = z.object({
  client_id: z.string().uuid('Invalid client ID'),
  customer_name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(LIMITS.CUSTOMER_NAME_MAX)
    .transform((s) => s.trim()),
  service: z.string().min(1, 'Please select a service').max(100),
  team_member: z.string().min(1, 'Please select a provider').max(100),
  comments: z
    .string()
    .max(LIMITS.COMMENTS_MAX_CHARS, `Comments must be under ${LIMITS.COMMENTS_MAX_CHARS} characters`)
    .optional()
    .transform((s) => s?.trim()),
  star_rating: z
    .number()
    .int()
    .min(4, 'Positive reviews must be 4+ stars')
    .max(5),
  source: z.enum(['qr', 'sms', 'email', 'web']).optional().default('web'),
  qr_code: z.string().max(50).optional(),
  // Honeypot: must be empty — bots fill it, humans don't see it
  honeypot: z.string().max(0, 'Bot detected').optional(),
})

// Submit feedback (negative path) — called from /api/submit-feedback
export const submitFeedbackSchema = z.object({
  client_id: z.string().uuid('Invalid client ID'),
  customer_name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(LIMITS.CUSTOMER_NAME_MAX)
    .transform((s) => s.trim()),
  contact: z
    .string()
    .max(LIMITS.CONTACT_MAX)
    .optional()
    .transform((s) => s?.trim()),
  feedback_text: z
    .string()
    .min(10, 'Please share at least a few words about your experience')
    .max(LIMITS.FEEDBACK_MAX_CHARS, `Feedback must be under ${LIMITS.FEEDBACK_MAX_CHARS} characters`)
    .transform((s) => s.trim()),
  star_rating: z
    .number()
    .int()
    .min(1)
    .max(3, 'Negative feedback must be 1-3 stars'),
  source: z.enum(['qr', 'sms', 'email', 'web']).optional().default('web'),
  qr_code: z.string().max(50).optional(),
  // Honeypot
  honeypot: z.string().max(0, 'Bot detected').optional(),
})

export type GenerateReviewInput = z.infer<typeof generateReviewSchema>
export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>
