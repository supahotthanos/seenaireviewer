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
      const msg = error instanceof Error ? error.message : 'Something went wrong. Please try again.'
      setToast({ message: msg, type: 'error' })
      setStep('positive-form')
    } finally {
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

  const handleCopyReview = async () => {
    try {
      await navigator.clipboard.writeText(editedReview)
      setToast({ message: 'Review copied to clipboard!', type: 'success' })

      // Track copy event
      if (reviewId) {
        fetch(`/api/reviews/${reviewId}/track`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ copied_to_clipboard: true }),
        }).catch(() => {})
      }
    } catch {
      setToast({ message: 'Copy failed. Please select and copy manually.', type: 'error' })
    }
  }

  const handlePostToGoogle = () => {
    const googleUrl = `https://search.google.com/local/writereview?placeid=${client.google_place_id}`
    window.open(googleUrl, '_blank', 'noopener,noreferrer')

    // Track redirect
    if (reviewId) {
      fetch(`/api/reviews/${reviewId}/track`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirected_to_google: true }),
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
          <h1 className="font-serif text-3xl text-white mb-2 font-light">
            How was your visit?
          </h1>
          <p className="text-white/50 text-sm font-sans mb-8">
            Your experience matters to us
          </p>
          <div className="flex justify-center mb-6">
            <StarRating value={rating} onChange={handleRatingSelect} size="lg" />
          </div>
          {rating > 0 && (
            <p className="text-white/40 text-xs font-sans animate-fade-in">
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
          <h2 className="font-serif text-2xl text-white mb-1 font-light">
            {FUNNEL_COPY.POSITIVE_TITLE}
          </h2>
          <p className="text-white/50 text-sm font-sans mb-6">
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
          <h2 className="font-serif text-2xl text-white mb-2 font-light">
            {FUNNEL_COPY.GENERATING_TITLE}
          </h2>
          <p className="text-white/50 text-sm font-sans">
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
          <h2 className="font-serif text-2xl text-white mb-1 font-light">
            {FUNNEL_COPY.REVIEW_READY_TITLE}
          </h2>
          <p className="text-white/50 text-sm font-sans mb-6">
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

          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <GlassButton
              onClick={handleCopyReview}
              variant="secondary"
              fullWidth
              className="sm:flex-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy Review
            </GlassButton>
            <GlassButton
              onClick={handlePostToGoogle}
              variant="primary"
              fullWidth
              className="sm:flex-1"
            >
              Post to Google
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </GlassButton>
          </div>

          <p className="text-white/30 text-xs font-sans text-center mt-4">
            Copy the review first, then tap &ldquo;Post to Google&rdquo; to open the review page.
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
          <h2 className="font-serif text-2xl text-white mb-1 font-light">
            {FUNNEL_COPY.NEGATIVE_TITLE}
          </h2>
          <p className="text-white/50 text-sm font-sans mb-6">
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
          <h2 className="font-serif text-2xl text-white mb-2 font-light">
            {FUNNEL_COPY.FEEDBACK_SENT_TITLE}
          </h2>
          <p className="text-white/50 text-sm font-sans leading-relaxed">
            {FUNNEL_COPY.FEEDBACK_SENT_SUBTITLE}
          </p>
        </GlassCard>
      </div>
    )
  }

  return null
}
