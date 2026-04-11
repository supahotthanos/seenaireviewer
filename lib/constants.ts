// Service → AEO keyword mapping for AI review generation
export const SERVICE_KEYWORDS: Record<string, string> = {
  Botox:
    'neuromodulator treatment, smooth forehead lines, natural-looking results, preventive wrinkle care',
  Filler:
    'dermal filler, volumizing results, natural facial contouring, lip enhancement, cheek definition',
  Microneedling:
    'collagen induction therapy, improved skin texture, radiant complexion, minimized pores',
  HydraFacial:
    'HydraFacial treatment, deep cleansing, hydrating facial, instant glow, brightening results',
  'Laser Hair Removal':
    'laser hair removal, smooth skin, permanent hair reduction, professional laser treatment',
  'Chemical Peel':
    'chemical peel, skin resurfacing, even skin tone, reduced hyperpigmentation, fresh glowing skin',
  Kybella: 'Kybella treatment, double chin reduction, defined jawline, contoured profile',
  PRP: 'PRP therapy, platelet-rich plasma, natural rejuvenation, collagen boost, skin renewal',
  'IV Therapy':
    'IV vitamin therapy, wellness infusion, energy boost, hydration therapy, immune support',
  Lashes:
    'lash enhancement, full lashes, eye-opening results, beautiful lashes, natural-looking lashes',
}

// Source tracking values
export const SOURCE_TYPES = {
  QR: 'qr',
  SMS: 'sms',
  EMAIL: 'email',
  WEB: 'web',
} as const

// Funnel copy
export const FUNNEL_COPY = {
  POSITIVE_TITLE: 'Share Your Experience',
  POSITIVE_SUBTITLE: "We're so glad you had a great visit! Tell others about it.",
  NEGATIVE_TITLE: 'We Want to Make It Right',
  NEGATIVE_SUBTITLE:
    "We're sorry your experience wasn't perfect. Please share your feedback so we can improve.",
  GENERATING_TITLE: 'Crafting Your Review…',
  GENERATING_SUBTITLE: 'Our AI is personalizing your review based on your experience.',
  REVIEW_READY_TITLE: 'Your Review is Ready',
  REVIEW_READY_SUBTITLE: 'Review, edit if you like, then copy and post to Google.',
  FEEDBACK_SENT_TITLE: 'Thank You for Your Feedback',
  FEEDBACK_SENT_SUBTITLE:
    "Your feedback has been shared privately with our team. We'll be in touch soon.",
}

// Rate limit identifiers
export const RATE_LIMIT_PREFIXES = {
  AI_GENERATE: 'ai_generate',
  FEEDBACK_SUBMIT: 'feedback_submit',
} as const

// Review character limits
export const LIMITS = {
  REVIEW_MAX_CHARS: 500,
  FEEDBACK_MAX_CHARS: 2000,
  COMMENTS_MAX_CHARS: 500,
  CUSTOMER_NAME_MAX: 100,
  CONTACT_MAX: 200,
}
