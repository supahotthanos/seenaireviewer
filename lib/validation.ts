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

// ────────────────────────────────────────────────────────────
// Admin: Create new client
// ────────────────────────────────────────────────────────────
export const createClientSchema = z.object({
  slug: z
    .string()
    .min(3)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and dashes only'),
  business_name: z.string().min(2).max(100),
  location_address: z.string().max(300).optional(),
  location_city: z.string().min(2).max(100),
  google_place_id: z.string().min(3).max(200),
  google_review_url: z
    .string()
    .url('Must be a valid URL')
    .max(500)
    .optional()
    .or(z.literal('')),
  notification_email: z
    .string()
    .min(5)
    .max(500)
    .refine(
      (s) =>
        s
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean)
          .every((e) => z.string().email().safeParse(e).success),
      'One or more emails are invalid'
    )
    .refine(
      (s) => s.split(',').map((e) => e.trim()).filter(Boolean).length > 0,
      'At least one email required'
    ),
  brand_color_primary: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color')
    .optional()
    .default('#c9a87c'),
  brand_color_secondary: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color')
    .optional()
    .default('#a01b1b'),
  logo_url: z.string().url().optional().or(z.literal('')),
  custom_domain: z
    .string()
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, 'Must be a valid domain name (e.g. reviews.lovmedspa.com)')
    .optional()
    .or(z.literal('')),
  services: z
    .array(z.string().min(1).max(100))
    .min(1, 'At least one service required')
    .max(50),
  team_members: z
    .array(z.string().min(1).max(100))
    .min(1, 'At least one team member required')
    .max(100),
  aliases: z
    .array(z.string().min(1).max(100))
    .max(20)
    .optional()
    .default([]),
  daily_ai_limit: z.number().int().min(1).max(1000).optional().default(150),
  is_active: z.boolean().optional().default(true),
})

export type CreateClientInput = z.infer<typeof createClientSchema>
