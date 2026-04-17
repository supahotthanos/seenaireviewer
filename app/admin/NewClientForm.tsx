'use client'

import { useState } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassInput } from '@/components/ui/GlassInput'
import { GlassTextarea } from '@/components/ui/GlassTextarea'
import { GlassButton } from '@/components/ui/GlassButton'
import { BrandHeader } from '@/components/BrandHeader'

export type ClientFormMode = 'create' | 'clone' | 'edit'

export interface ClientSeed {
  id?: string
  business_name?: string
  slug?: string
  location_address?: string | null
  location_city?: string
  google_place_id?: string
  notification_email?: string
  brand_color_primary?: string
  brand_color_secondary?: string
  logo_url?: string | null
  custom_domain?: string | null
  services?: string[]
  team_members?: string[]
  daily_ai_limit?: number
  is_active?: boolean
}

interface NewClientFormProps {
  adminKey: string
  onClose: () => void
  onSaved: (slug: string, mode: ClientFormMode) => void
  mode?: ClientFormMode
  seed?: ClientSeed | null
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 50)
}

function parseList(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((line) => line.replace(/^[\s\-•*\d.)]+/, '').trim())
    .filter((s) => s.length > 0 && s.length <= 100)
}

function buildInitialForm(mode: ClientFormMode, seed: ClientSeed | null | undefined) {
  const base = {
    business_name: '',
    slug: '',
    location_address: '',
    location_city: '',
    google_place_id: '',
    notification_email: '',
    brand_color_primary: '#c9a87c',
    brand_color_secondary: '#a01b1b',
    logo_url: '',
    custom_domain: '',
    services_text: '',
    team_text: '',
    daily_ai_limit: 50,
    is_active: true,
  }
  if (!seed) return base

  // Brand-level fields — kept on both clone and edit.
  base.business_name = seed.business_name ?? ''
  base.notification_email = seed.notification_email ?? ''
  base.brand_color_primary = seed.brand_color_primary ?? '#c9a87c'
  base.brand_color_secondary = seed.brand_color_secondary ?? '#a01b1b'
  base.logo_url = seed.logo_url ?? ''
  base.services_text = (seed.services ?? []).join('\n')
  base.team_text = (seed.team_members ?? []).join('\n')
  base.daily_ai_limit = seed.daily_ai_limit ?? 50
  base.is_active = seed.is_active ?? true

  // Location-level fields — only kept on edit. Clone leaves them blank so
  // the operator fills in the new location's unique info.
  if (mode === 'edit') {
    base.slug = seed.slug ?? ''
    base.custom_domain = seed.custom_domain ?? ''
    base.location_address = seed.location_address ?? ''
    base.location_city = seed.location_city ?? ''
    base.google_place_id = seed.google_place_id ?? ''
  }

  return base
}

export default function NewClientForm({
  adminKey,
  onClose,
  onSaved,
  mode = 'create',
  seed = null,
}: NewClientFormProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ slug: string; url: string; mode: ClientFormMode } | null>(null)

  const [form, setForm] = useState(() => buildInitialForm(mode, seed))

  const isEdit = mode === 'edit'
  const isClone = mode === 'clone'

  // Auto-generate slug from business name + city — only when the slug field
  // is empty. In edit mode this never runs (slug is locked).
  const updateBusinessName = (name: string) => {
    setForm((f) => {
      if (isEdit) return { ...f, business_name: name }
      const newSlug = slugify(name + (f.location_city ? ` ${f.location_city.split(',')[0]}` : ''))
      return { ...f, business_name: name, slug: f.slug || newSlug }
    })
  }

  const updateCity = (city: string) => {
    setForm((f) => {
      if (isEdit) return { ...f, location_city: city }
      const newSlug = slugify(f.business_name + ` ${city.split(',')[0]}`)
      return { ...f, location_city: city, slug: f.slug || newSlug }
    })
  }

  const handleSubmit = async () => {
    setError(null)

    const services = parseList(form.services_text)
    const team_members = parseList(form.team_text)

    if (services.length === 0) {
      setError('Add at least one service (one per line)')
      return
    }
    if (team_members.length === 0) {
      setError('Add at least one team member (one per line)')
      return
    }
    if (!form.google_place_id || form.google_place_id.length < 5) {
      setError('Google Place ID is required')
      return
    }
    if (!form.notification_email.includes('@')) {
      setError('Valid notification email required')
      return
    }
    if (!isEdit && !form.slug) {
      setError('Slug is required')
      return
    }

    setSubmitting(true)

    try {
      let response: Response
      if (isEdit) {
        if (!seed?.id) throw new Error('Missing client id for edit')
        response = await fetch(`/api/admin/clients?key=${encodeURIComponent(adminKey)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: seed.id,
            updates: {
              business_name: form.business_name,
              location_address: form.location_address || null,
              location_city: form.location_city,
              google_place_id: form.google_place_id,
              notification_email: form.notification_email,
              brand_color_primary: form.brand_color_primary,
              brand_color_secondary: form.brand_color_secondary,
              logo_url: form.logo_url || null,
              custom_domain: form.custom_domain || null,
              services,
              team_members,
              daily_ai_limit: form.daily_ai_limit,
              is_active: form.is_active,
            },
          }),
        })
      } else {
        response = await fetch(`/api/admin/clients?key=${encodeURIComponent(adminKey)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: form.slug,
            business_name: form.business_name,
            location_address: form.location_address || undefined,
            location_city: form.location_city,
            google_place_id: form.google_place_id,
            notification_email: form.notification_email,
            brand_color_primary: form.brand_color_primary,
            brand_color_secondary: form.brand_color_secondary,
            logo_url: form.logo_url || undefined,
            custom_domain: form.custom_domain || undefined,
            services,
            team_members,
            daily_ai_limit: form.daily_ai_limit,
          }),
        })
      }

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Request failed')
      }

      const finalSlug = isEdit ? (data.client?.slug ?? seed?.slug ?? form.slug) : form.slug
      const url = `${window.location.origin}/${finalSlug}`
      setSuccess({ slug: finalSlug, url, mode })
      onSaved(finalSlug, mode)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  // ────────────────────────────────────────
  // Success screen
  // ────────────────────────────────────────
  if (success) {
    const title = success.mode === 'edit' ? 'Saved' : 'Client Created'
    const subtitle =
      success.mode === 'edit'
        ? 'Changes are live now.'
        : 'The funnel is live. Share this link with the spa.'
    return (
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm overflow-y-auto p-4">
        <div className="max-w-md mx-auto mt-12">
          <GlassCard className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-[#c9a87c]/10 border border-[#c9a87c]/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-[#c9a87c]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h2 className="font-serif text-2xl text-white mb-2 font-light">{title}</h2>
            <p className="text-white/50 text-sm font-sans mb-5">{subtitle}</p>

            <div className="bg-black/30 rounded-xl p-4 mb-5">
              <p className="text-white/40 text-xs font-sans mb-1">Live URL</p>
              <p className="text-[#c9a87c] text-sm font-mono break-all">{success.url}</p>
            </div>

            <div className="flex gap-2">
              <GlassButton
                variant="secondary"
                fullWidth
                onClick={() => navigator.clipboard.writeText(success.url)}
              >
                Copy URL
              </GlassButton>
              <GlassButton variant="primary" fullWidth onClick={onClose}>
                Done
              </GlassButton>
            </div>
          </GlassCard>
        </div>
      </div>
    )
  }

  // ────────────────────────────────────────
  // Form screen
  // ────────────────────────────────────────
  const previewClient = {
    business_name: form.business_name || 'Business Name',
    location_address: form.location_address || null,
    brand_color_primary: form.brand_color_primary,
    brand_color_secondary: form.brand_color_secondary,
    logo_url: form.logo_url || null,
  }

  const headerTitle = isEdit
    ? `Edit — ${seed?.business_name || 'Location'}`
    : isClone
    ? `New Location (cloning ${seed?.business_name || 'existing'})`
    : 'New Client Location'

  const cloneHint =
    isClone &&
    'Brand fields are pre-filled from the source location. Enter the unique info for the new location below (city, address, Google Place ID).'

  const submitLabel = isEdit ? 'Save Changes' : 'Create Location'

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full p-4 flex items-start justify-center">
        <div className="max-w-2xl w-full my-8">
          <GlassCard>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-2xl text-white font-light">{headerTitle}</h2>
              <button
                onClick={onClose}
                className="text-white/40 hover:text-white transition-colors text-2xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {cloneHint && (
              <div className="mb-4 p-3 bg-[#c9a87c]/10 border border-[#c9a87c]/30 rounded-xl text-[#c9a87c] text-sm font-sans">
                {cloneHint}
              </div>
            )}

            {/* Live preview */}
            <div className="mb-6 p-4 bg-black/20 rounded-xl border border-white/5">
              <p className="text-white/30 text-xs font-sans uppercase tracking-widest mb-2">Preview</p>
              <BrandHeader client={previewClient} size="sm" showAddress={false} />
            </div>

            <div className="space-y-4">
              {/* Business Identity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <GlassInput
                  label="Business Name *"
                  placeholder="e.g. Glow Aesthetics"
                  value={form.business_name}
                  onChange={(e) => updateBusinessName(e.target.value)}
                />
                <GlassInput
                  label="City, State *"
                  placeholder="e.g. Miami, FL"
                  value={form.location_city}
                  onChange={(e) => updateCity(e.target.value)}
                />
              </div>

              {isEdit ? (
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5 font-sans">
                    Slug (URL — locked after creation)
                  </label>
                  <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/60 font-mono text-sm">
                    /{form.slug}
                  </div>
                  <p className="text-white/40 text-xs font-sans mt-1">
                    The URL slug cannot change — existing QR codes, SMS links, and bookmarks point to it.
                  </p>
                </div>
              ) : (
                <>
                  <GlassInput
                    label="Slug (URL) *"
                    placeholder="lowercase-with-dashes"
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                  />
                  <p className="text-white/40 text-xs font-sans -mt-3">
                    Will be live at: <span className="text-[#c9a87c]">/{form.slug || 'your-slug'}</span>
                  </p>
                </>
              )}

              <GlassInput
                label="Custom Domain (optional whitelabeling)"
                placeholder="reviews.lovmedspa.com"
                value={form.custom_domain}
                onChange={(e) => setForm((f) => ({ ...f, custom_domain: e.target.value.toLowerCase().trim() }))}
              />

              <GlassInput
                label="Full Address (optional)"
                placeholder="123 Main St, City, State 12345"
                value={form.location_address}
                onChange={(e) => setForm((f) => ({ ...f, location_address: e.target.value }))}
              />

              {/* Google + Email */}
              <div>
                <GlassInput
                  label="Google Place ID *"
                  placeholder="ChIJxxxxxxxxxxxx"
                  value={form.google_place_id}
                  onChange={(e) => setForm((f) => ({ ...f, google_place_id: e.target.value }))}
                />
                <div className="flex items-center justify-between flex-wrap gap-2 mt-2">
                  <p className="text-white/40 text-xs font-sans">
                    Find at:{' '}
                    <a
                      href="https://developers.google.com/maps/documentation/places/web-service/place-id"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#c9a87c] hover:underline"
                    >
                      Google Place ID Finder ↗
                    </a>
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (!form.google_place_id || form.google_place_id.length < 5) {
                        setError('Enter a Google Place ID first to test it')
                        return
                      }
                      setError(null)
                      window.open(
                        `https://search.google.com/local/writereview?placeid=${encodeURIComponent(form.google_place_id)}`,
                        '_blank',
                        'noopener,noreferrer'
                      )
                    }}
                    className="text-xs font-sans bg-[#c9a87c]/10 hover:bg-[#c9a87c]/20 text-[#c9a87c] border border-[#c9a87c]/30 px-3 py-1.5 rounded-lg transition-all"
                  >
                    Test Google Link ↗
                  </button>
                </div>
                <p className="text-white/30 text-xs font-sans mt-1">
                  Click &ldquo;Test Google Link&rdquo; — the Google review form should open for the correct business. If wrong, your Place ID is wrong.
                </p>
              </div>

              <GlassInput
                label="Notification Email(s) *"
                placeholder="owner@example.com, manager@example.com"
                value={form.notification_email}
                onChange={(e) => setForm((f) => ({ ...f, notification_email: e.target.value }))}
              />
              <p className="text-white/40 text-xs font-sans -mt-3">
                Comma-separate multiple emails. All will receive bad-review alerts.
              </p>

              {/* Services + Team */}
              <GlassTextarea
                label="Services * (one per line)"
                placeholder={'Botox\nFiller\nMicroneedling\nHydraFacial\nLaser Hair Removal'}
                rows={6}
                value={form.services_text}
                onChange={(e) => setForm((f) => ({ ...f, services_text: e.target.value }))}
              />
              <p className="text-white/40 text-xs font-sans -mt-3">
                Parsed: <span className="text-[#c9a87c]">{parseList(form.services_text).length}</span> services
              </p>

              <GlassTextarea
                label="Team Members * (one per line)"
                placeholder={'Dr. Sarah Lov\nJennifer Smith, RN\nMaria Rodriguez'}
                rows={5}
                value={form.team_text}
                onChange={(e) => setForm((f) => ({ ...f, team_text: e.target.value }))}
              />
              <p className="text-white/40 text-xs font-sans -mt-3">
                Parsed: <span className="text-[#c9a87c]">{parseList(form.team_text).length}</span> team members
              </p>

              {/* Branding */}
              <div className="border-t border-white/10 pt-4">
                <p className="text-white/60 text-sm font-sans mb-3">Branding (optional)</p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1.5 font-sans">
                      Primary Color
                    </label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={form.brand_color_primary}
                        onChange={(e) => setForm((f) => ({ ...f, brand_color_primary: e.target.value }))}
                        className="h-11 w-14 rounded-lg cursor-pointer bg-transparent border border-white/10"
                      />
                      <input
                        type="text"
                        value={form.brand_color_primary}
                        onChange={(e) => setForm((f) => ({ ...f, brand_color_primary: e.target.value }))}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-[16px] font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1.5 font-sans">
                      Secondary Color
                    </label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={form.brand_color_secondary}
                        onChange={(e) => setForm((f) => ({ ...f, brand_color_secondary: e.target.value }))}
                        className="h-11 w-14 rounded-lg cursor-pointer bg-transparent border border-white/10"
                      />
                      <input
                        type="text"
                        value={form.brand_color_secondary}
                        onChange={(e) => setForm((f) => ({ ...f, brand_color_secondary: e.target.value }))}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-[16px] font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <GlassInput
                    label="Logo URL (optional)"
                    placeholder="https://example.com/logo.png"
                    value={form.logo_url}
                    onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))}
                  />
                  <p className="text-white/40 text-xs font-sans mt-1">
                    Paste any image URL. If blank, the business name will be styled with the brand colors.
                  </p>
                </div>
              </div>

              {/* Rate limit + active toggle */}
              <div className="border-t border-white/10 pt-4 space-y-3">
                <GlassInput
                  label="Daily AI Review Limit (per location)"
                  type="number"
                  min={1}
                  max={1000}
                  value={String(form.daily_ai_limit)}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, daily_ai_limit: Math.max(1, Math.min(1000, Number(e.target.value) || 50)) }))
                  }
                />
                <p className="text-white/40 text-xs font-sans">
                  Caps how many AI reviews this location can generate per day. Default 50. Protects your Anthropic credits from abuse.
                </p>

                {isEdit && (
                  <label className="flex items-center gap-3 cursor-pointer select-none pt-1">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                      className="w-4 h-4 accent-[#c9a87c]"
                    />
                    <span className="text-white/80 text-sm font-sans">
                      Active — uncheck to disable this location without deleting it
                    </span>
                  </label>
                )}
              </div>

              {/* Errors */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-300 text-sm font-sans">
                  {error}
                </div>
              )}

              {/* Submit */}
              <div className="flex gap-3 pt-2">
                <GlassButton variant="secondary" onClick={onClose} fullWidth>
                  Cancel
                </GlassButton>
                <GlassButton
                  variant="primary"
                  onClick={handleSubmit}
                  loading={submitting}
                  fullWidth
                >
                  {submitLabel}
                </GlassButton>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
