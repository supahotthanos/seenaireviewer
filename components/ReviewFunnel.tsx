'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import type { Client, FunnelStep } from '@/lib/types'
import { LIMITS, FUNNEL_COPY } from '@/lib/constants'
import { GlassCard } from './ui/GlassCard'
import { StarRating } from './ui/StarRating'
import { GlassInput } from './ui/GlassInput'
import { GlassSelect } from './ui/GlassSelect'
import { GlassTextarea } from './ui/GlassTextarea'
import { GlassButton } from './ui/GlassButton'
import { StepIndicator } from './ui/StepIndicator'
import { Toast } from './ui/Toast'
import { BrandHeader } from './BrandHeader'

interface ReviewFunnelProps {
  client: Client
}

interface PositiveFormData {
  name: string
  service: string
  teamMember: string
  comments: string
  honeypot: string
}

interface NegativeFormData {
  name: string
  contact: string
  feedback: string
  honeypot: string
}

interface FormErrors {
  [key: string]: string
}

export default function ReviewFunnel({ client }: ReviewFunnelProps) {
  const searchParams = useSearchParams()
  const source = (searchParams.get('src') || 'web') as 'qr' | 'sms' | 'email' | 'web'
  const qrCode = searchParams.get('qr') || undefined

  const [step, setStep] = useState<FunnelStep>('rating')
  const [rating, setRating] = useState(0)
  const [positiveForm, setPositiveForm] = useState<PositiveFormData>({
    name: '',
    service: '',
    teamMember: '',
    comments: '',
    honeypot: '',
  })
  const [negativeForm, setNegativeForm] = useState<NegativeFormData>({
    name: '',
    contact: '',
    feedback: '',
    honeypot: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isLoading, setIsLoading] = useState(false)
  const [generatedReview, setGeneratedReview] = useState('')
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [editedReview, setEditedReview] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [isPosting, setIsPosting] = useState(false)

  const reviewTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus review textarea when it appears
  useEffect(() => {
    if (step === 'review-ready' && reviewTextareaRef.current) {
      reviewTextareaRef.current.focus()
    }
  }, [step])

  const handleRatingSelect = useCallback((selectedRating: number) => {
    setRating(selectedRating)
    setTimeout(() => {
      if (selectedRating >= 4) {
        setStep('positive-form')
      } else {
        setStep('negative-form')
      }
    }, 300)
  }, [])

  const validatePositiveForm = (): boolean => {
    const newErrors: FormErrors = {}
    if (!positiveForm.name.trim() || positiveForm.name.trim().length < 2) {
      newErrors.name = 'Please enter your name (at least 2 characters)'
    }
    if (!positiveForm.service) {
      newErrors.service = 'Please select the service you received'
    }
    if (!positiveForm.teamMember) {
      newErrors.teamMember = 'Please select your provider'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validateNegativeForm = (): boolean => {
    const newErrors: FormErrors = {}
    if (!negativeForm.name.trim() || negativeForm.name.trim().length < 2) {
      newErrors.name = 'Please enter your name (at least 2 characters)'
    }
    if (!negativeForm.feedback.trim() || negativeForm.feedback.trim().length < 10) {
      newErrors.feedback = 'Please share a bit more about your experience (at least 10 characters)'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handlePositiveSubmit = async () => {
    if (!validatePositiveForm()) return
    // Honeypot check
    if (positiveForm.honeypot) return

    setIsLoading(true)
    setStep('generating')

    // Client-side timeout: if the server (Anthropic + DB insert) takes
    // longer than 25s, abort so the customer sees an error instead of a
    // stuck spinner. Anthropic's own timeout is 15s — this is the outer
    // guard in case the serverless function itself hangs.
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25_000)

    try {
      const response = await fetch('/api/generate-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: client.id,
          customer_name: positiveForm.name.trim(),
          service: positiveForm.service,
          team_member: positiveForm.teamMember,
          comments: positiveForm.comments.trim() || undefined,
          star_rating: rating,
          source,
          qr_code: qrCode,
          honeypot: positiveForm.honeypot,
        }),
        signal: controller.signal,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate review')
      }

      setGeneratedReview(data.generated_review)
      setEditedReview(data.generated_review)
      setReviewId(data.review_id)
      setStep('review-ready')
    } catch (error) {
      const msg =
        error instanceof DOMException && error.name === 'AbortError'
          ? 'This is taking longer than expected. Please try again.'
          : error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.'
      setToast({ message: msg, type: 'error' })
      setStep('positive-form')
    } finally {
      clearTimeout(timeoutId)
      setIsLoading(false)
    }
  }

  const handleNegativeSubmit = async () => {
    if (!validateNegativeForm()) return
    if (negativeForm.honeypot) return

    setIsLoading(true)

    try {
      const response = await fetch('/api/submit-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: client.id,
          customer_name: negativeForm.name.trim(),
          contact: negativeForm.contact.trim() || undefined,
          feedback_text: negativeForm.feedback.trim(),
          star_rating: rating,
          source,
          qr_code: qrCode,
          honeypot: negativeForm.honeypot,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit feedback')
      }

      setStep('feedback-sent')
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Something went wrong. Please try again.'
      setToast({ message: msg, type: 'error' })
    } finally {
      setIsLoading(false)
    }
  }

  // Build the GBP-style write-review URL. Same params Google's own QR codes
  // use — triggers the review dialog directly on mobile, not the profile.
  const buildGoogleReviewUrl = (): string => {
    const pid = (client.google_place_id || '').trim()
    const override = client.google_review_url?.trim()
    if (/^ChIJ/i.test(pid)) {
      const params = new URLSearchParams({
        placeid: pid,
        source: 'g.page.m.ia._',
        utm_source: 'gbp',
        laa: 'nmx-review-solicitation-ia2',
      })
      return `https://search.google.com/local/writereview?${params.toString()}`
    }
    if (override) return override
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${client.business_name} ${client.location_address || client.location_city}`
    )}`
  }

  // Belt-and-suspenders clipboard copy. Modern Clipboard API first, then the
  // execCommand fallback for older iOS / strict permission contexts. Works
  // even when the page is briefly unfocused (which happens on iOS Safari
  // when a new tab opens).
  const copyToClipboard = (text: string, fallbackEl?: HTMLTextAreaElement | null): boolean => {
    // Try execCommand first if we have a textarea — it's the most reliable
    // path on iOS Safari because it uses DOM selection (same user gesture).
    if (fallbackEl) {
      try {
        fallbackEl.focus()
        fallbackEl.setSelectionRange(0, text.length)
        const ok = document.execCommand('copy')
        fallbackEl.setSelectionRange(text.length, text.length) // deselect
        if (ok) return true
      } catch {
        /* fall through */
      }
    }
    // Modern API fallback (fire-and-forget; may resolve after window.open
    // on iOS but still succeeds because it was initiated in the gesture).
    try {
      navigator.clipboard?.writeText(text).catch(() => {})
      return true
    } catch {
      return false
    }
  }

  // Single-tap flow: copy the review AND open Google's write-review dialog.
  // Critical order for iOS Safari:
  //   1. Copy FIRST via execCommand (stays in user gesture)
  //   2. window.open SYNCHRONOUSLY right after (avoids popup blocker)
  //   3. Track events in the background (fire-and-forget)
  const handlePostToGoogle = () => {
    if (isPosting) return // debounce — prevent multiple window.opens on rapid taps
    setIsPosting(true)
    // Re-enable after 2s. Long enough to cover a second tap before the new
    // tab opens, short enough that a customer who returns and wants to
    // re-trigger isn't blocked.
    setTimeout(() => setIsPosting(false), 2000)

    const copied = copyToClipboard(editedReview, reviewTextareaRef.current)
    const googleUrl = buildGoogleReviewUrl()
    // window.open MUST be synchronous inside the click handler — any prior
    // await/Promise breaks iOS's popup-block gesture window.
    window.open(googleUrl, '_blank', 'noopener,noreferrer')

    setToast({
      message: copied
        ? 'Copied! Paste in the Google review box.'
        : 'Long-press the text above to copy, then paste in Google.',
      type: copied ? 'success' : 'error',
    })

    // Track both events in one PATCH
    if (reviewId) {
      fetch(`/api/reviews/${reviewId}/track`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ copied_to_clipboard: copied, redirected_to_google: true }),
      }).catch(() => {})
    }
  }

  // Brand header is now imported from components/BrandHeader.tsx
  // It renders the business name with two-tone color split using brand colors

  // ──────────────────────────────────────────────────────────
  // STEP: Rating
  // ──────────────────────────────────────────────────────────
  if (step === 'rating') {
    return (
      <div className="animate-slide-up">
        <BrandHeader client={client} />
        <GlassCard className="text-center">
          <h1 className="font-serif text-3xl text-[color:var(--text)] mb-2 font-light">
            How was your visit?
          </h1>
          <p className="text-[color:var(--text-muted)] text-sm font-sans mb-8">
            Your experience matters to us
          </p>
          <div className="flex justify-center mb-6">
            <StarRating value={rating} onChange={handleRatingSelect} size="lg" />
          </div>
          {rating > 0 && (
            <p className="text-[color:var(--text-muted)] text-xs font-sans animate-fade-in">
              {rating >= 4 ? 'Great! Tap to confirm' : 'Tap to confirm'}
            </p>
          )}
        </GlassCard>
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────
  // STEP: Positive Form
  // ──────────────────────────────────────────────────────────
  if (step === 'positive-form') {
    return (
      <div className="animate-slide-up">
        <BrandHeader client={client} />
        <GlassCard>
          <div className="mb-6">
            <StepIndicator steps={3} current={1} />
          </div>
          <div className="flex items-center gap-2 mb-1">
            <StarRating value={rating} onChange={() => {}} size="sm" readonly />
          </div>
          <h2 className="font-serif text-2xl text-[color:var(--text)] mb-1 font-light">
            {FUNNEL_COPY.POSITIVE_TITLE}
          </h2>
          <p className="text-[color:var(--text-muted)] text-sm font-sans mb-6">
            {FUNNEL_COPY.POSITIVE_SUBTITLE}
          </p>

          <div className="space-y-4">
            <GlassInput
              label="Your Name"
              placeholder="First name or full name"
              value={positiveForm.name}
              onChange={(e) => setPositiveForm((p) => ({ ...p, name: e.target.value }))}
              error={errors.name}
              autoComplete="given-name"
            />

            <GlassSelect
              label="Service Received"
              placeholder="Select a service…"
              options={client.services}
              value={positiveForm.service}
              onChange={(e) => setPositiveForm((p) => ({ ...p, service: e.target.value }))}
              error={errors.service}
            />

            <GlassSelect
              label="Your Provider"
              placeholder="Select your provider…"
              options={client.team_members}
              value={positiveForm.teamMember}
              onChange={(e) => setPositiveForm((p) => ({ ...p, teamMember: e.target.value }))}
              error={errors.teamMember}
            />

            <GlassTextarea
              label="Anything you'd like us to highlight? (optional)"
              placeholder="e.g. The results were incredible, I felt so comfortable…"
              rows={3}
              value={positiveForm.comments}
              onChange={(e) =>
                setPositiveForm((p) => ({ ...p, comments: e.target.value.slice(0, LIMITS.COMMENTS_MAX_CHARS) }))
              }
              maxChars={LIMITS.COMMENTS_MAX_CHARS}
              currentLength={positiveForm.comments.length}
            />

            {/* Honeypot — hidden from humans */}
            <input
              type="text"
              name="website"
              value={positiveForm.honeypot}
              onChange={(e) => setPositiveForm((p) => ({ ...p, honeypot: e.target.value }))}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute opacity-0 pointer-events-none w-0 h-0"
            />
          </div>

          <GlassButton
            onClick={handlePositiveSubmit}
            loading={isLoading}
            fullWidth
            className="mt-6"
          >
            Generate My Review
          </GlassButton>
        </GlassCard>
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────
  // STEP: Generating
  // ──────────────────────────────────────────────────────────
  if (step === 'generating') {
    return (
      <div className="animate-fade-in">
        <BrandHeader client={client} />
        <GlassCard className="text-center">
          <div className="mb-6">
            <StepIndicator steps={3} current={2} />
          </div>
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-full border-2 border-[#c9a87c]/30 border-t-[#c9a87c] animate-spin" />
          </div>
          <h2 className="font-serif text-2xl text-[color:var(--text)] mb-2 font-light">
            {FUNNEL_COPY.GENERATING_TITLE}
          </h2>
          <p className="text-[color:var(--text-muted)] text-sm font-sans">
            {FUNNEL_COPY.GENERATING_SUBTITLE}
          </p>
        </GlassCard>
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────
  // STEP: Review Ready
  // ──────────────────────────────────────────────────────────
  if (step === 'review-ready') {
    return (
      <div className="animate-slide-up">
        <BrandHeader client={client} />
        <GlassCard>
          <div className="mb-6">
            <StepIndicator steps={3} current={3} />
          </div>
          <h2 className="font-serif text-2xl text-[color:var(--text)] mb-1 font-light">
            {FUNNEL_COPY.REVIEW_READY_TITLE}
          </h2>
          <p className="text-[color:var(--text-muted)] text-sm font-sans mb-6">
            {FUNNEL_COPY.REVIEW_READY_SUBTITLE}
          </p>

          <GlassTextarea
            ref={reviewTextareaRef}
            label="Your Review (edit if you like)"
            rows={8}
            value={editedReview}
            onChange={(e) =>
              setEditedReview(e.target.value.slice(0, LIMITS.REVIEW_MAX_CHARS))
            }
            maxChars={LIMITS.REVIEW_MAX_CHARS}
            currentLength={editedReview.length}
          />

          {/* Prominent red-glow paste reminder — impossible to miss.
              Shown BEFORE the button so customers know exactly what to do
              as soon as the new tab opens. */}
          <div
            className="paste-reminder mt-6 p-4 rounded-xl border-2 border-red-500/80 bg-red-500/10 dark:bg-red-500/15"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <svg
                className="w-6 h-6 shrink-0 text-red-600 dark:text-red-400 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
              <div className="flex-1">
                <p className="font-serif text-lg text-red-700 dark:text-red-300 font-medium mb-1 leading-tight">
                  Don&apos;t forget to paste your review!
                </p>
                <p className="text-sm text-black/75 dark:text-white/85 font-sans leading-relaxed">
                  Your review is already copied. On the next screen, <span className="font-semibold underline decoration-red-500/60 underline-offset-2">long-press the Google review box</span> and tap <span className="font-semibold">Paste</span>.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <GlassButton
              onClick={handlePostToGoogle}
              variant="primary"
              fullWidth
              disabled={isPosting}
            >
              Copy &amp; Post to Google
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </GlassButton>
          </div>

          <p className="text-[color:var(--text-subtle)] text-xs font-sans text-center mt-4">
            If Google shows the business page, tap &ldquo;Write a review&rdquo; and paste there.
          </p>
        </GlassCard>

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onDismiss={() => setToast(null)}
          />
        )}
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────
  // STEP: Negative Form
  // ──────────────────────────────────────────────────────────
  if (step === 'negative-form') {
    return (
      <div className="animate-slide-up">
        <BrandHeader client={client} />
        <GlassCard>
          <div className="flex items-center gap-2 mb-1">
            <StarRating value={rating} onChange={() => {}} size="sm" readonly />
          </div>
          <h2 className="font-serif text-2xl text-[color:var(--text)] mb-1 font-light">
            {FUNNEL_COPY.NEGATIVE_TITLE}
          </h2>
          <p className="text-[color:var(--text-muted)] text-sm font-sans mb-6">
            {FUNNEL_COPY.NEGATIVE_SUBTITLE}
          </p>

          <div className="space-y-4">
            <GlassInput
              label="Your Name"
              placeholder="First name or full name"
              value={negativeForm.name}
              onChange={(e) => setNegativeForm((p) => ({ ...p, name: e.target.value }))}
              error={errors.name}
              autoComplete="given-name"
            />

            <GlassInput
              label="Phone or Email (optional)"
              placeholder="So we can follow up with you"
              value={negativeForm.contact}
              onChange={(e) => setNegativeForm((p) => ({ ...p, contact: e.target.value }))}
              type="text"
              inputMode="text"
              autoComplete="off"
            />

            <GlassTextarea
              label="What could we have done better?"
              placeholder="Please share your experience so we can improve…"
              rows={5}
              value={negativeForm.feedback}
              onChange={(e) =>
                setNegativeForm((p) => ({ ...p, feedback: e.target.value.slice(0, LIMITS.FEEDBACK_MAX_CHARS) }))
              }
              maxChars={LIMITS.FEEDBACK_MAX_CHARS}
              currentLength={negativeForm.feedback.length}
              error={errors.feedback}
            />

            {/* Honeypot */}
            <input
              type="text"
              name="website"
              value={negativeForm.honeypot}
              onChange={(e) => setNegativeForm((p) => ({ ...p, honeypot: e.target.value }))}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute opacity-0 pointer-events-none w-0 h-0"
            />
          </div>

          <GlassButton
            onClick={handleNegativeSubmit}
            loading={isLoading}
            variant="danger"
            fullWidth
            className="mt-6"
          >
            Submit Feedback
          </GlassButton>
        </GlassCard>

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onDismiss={() => setToast(null)}
          />
        )}
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────
  // STEP: Feedback Sent
  // ──────────────────────────────────────────────────────────
  if (step === 'feedback-sent') {
    return (
      <div className="animate-slide-up">
        <BrandHeader client={client} />
        <GlassCard className="text-center">
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-full bg-[#c9a87c]/10 border border-[#c9a87c]/20 flex items-center justify-center">
              <svg className="w-7 h-7 text-[#c9a87c]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h2 className="font-serif text-2xl text-[color:var(--text)] mb-2 font-light">
            {FUNNEL_COPY.FEEDBACK_SENT_TITLE}
          </h2>
          <p className="text-[color:var(--text-muted)] text-sm font-sans leading-relaxed">
            {FUNNEL_COPY.FEEDBACK_SENT_SUBTITLE}
          </p>
        </GlassCard>
      </div>
    )
  }

  return null
}
