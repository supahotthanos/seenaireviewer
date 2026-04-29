// Database types derived from Supabase schema

export interface Client {
  id: string
  slug: string
  business_name: string
  location_address: string | null
  location_city: string
  google_place_id: string
  google_review_url: string | null
  custom_domain: string | null
  logo_url: string | null
  brand_color_primary: string
  brand_color_secondary: string
  services: string[]
  team_members: string[]
  aliases: string[]
  notification_email: string
  notification_phone: string | null
  is_active: boolean
  monthly_review_limit: number
  daily_ai_limit: number
  created_at: string
  updated_at: string
}

export interface Review {
  id: string
  client_id: string
  customer_name: string
  customer_phone: string | null
  customer_email: string | null
  star_rating: number
  service_selected: string | null
  team_member_selected: string | null
  original_comments: string | null
  generated_review: string | null
  review_type: 'positive' | 'negative'
  copied_to_clipboard: boolean
  redirected_to_google: boolean
  source: 'qr' | 'sms' | 'email' | 'web'
  ip_hash: string | null
  user_agent: string | null
  created_at: string
}

export interface QRCode {
  id: string
  client_id: string
  label: string | null
  short_code: string
  scan_count: number
  is_active: boolean
  created_at: string
}

// API input types — inferred from Zod schemas in lib/validation.ts
export type { GenerateReviewInput, SubmitFeedbackInput, CreateClientInput } from './validation'

// Funnel step states
export type FunnelStep =
  | 'rating'
  | 'positive-form'
  | 'generating'
  | 'review-ready'
  | 'negative-form'
  | 'feedback-sent'
