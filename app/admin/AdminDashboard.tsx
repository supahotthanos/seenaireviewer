'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassInput } from '@/components/ui/GlassInput'
import { Toast } from '@/components/ui/Toast'
import NewClientForm, { ClientFormMode, ClientSeed } from './NewClientForm'

interface ClientWithStats {
  id: string
  slug: string
  business_name: string
  location_city: string
  location_address: string | null
  google_place_id: string
  notification_email: string
  services: string[]
  team_members: string[]
  brand_color_primary: string | null
  brand_color_secondary: string | null
  logo_url: string | null
  daily_ai_limit: number | null
  is_active: boolean
  created_at: string
  stats: { positive: number; negative: number; total: number }
}

interface QRCodeRow {
  id: string
  client_id: string
  short_code: string
  label: string | null
  scan_count: number
  is_active: boolean
  created_at: string
}

interface ReviewRow {
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
  source: string
  created_at: string
}

export default function AdminDashboard() {
  const searchParams = useSearchParams()
  const key = searchParams.get('key') || ''

  const [clients, setClients] = useState<ClientWithStats[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [qrCodes, setQrCodes] = useState<QRCodeRow[]>([])
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [activeTab, setActiveTab] = useState<'qr' | 'reviews'>('qr')
  const [generatingQR, setGeneratingQR] = useState(false)
  const [qrLabel, setQrLabel] = useState('')
  const [newQrPreview, setNewQrPreview] = useState<{ data_url: string; short_code: string; qr_url: string } | null>(null)
  const [formState, setFormState] = useState<{ mode: ClientFormMode; seed: ClientSeed | null } | null>(null)

  function toSeed(c: ClientWithStats): ClientSeed {
    return {
      id: c.id,
      business_name: c.business_name,
      slug: c.slug,
      location_address: c.location_address,
      location_city: c.location_city,
      google_place_id: c.google_place_id,
      notification_email: c.notification_email,
      brand_color_primary: c.brand_color_primary ?? undefined,
      brand_color_secondary: c.brand_color_secondary ?? undefined,
      logo_url: c.logo_url,
      services: c.services,
      team_members: c.team_members,
      daily_ai_limit: c.daily_ai_limit ?? undefined,
      is_active: c.is_active,
    }
  }

  // Reusable client fetch
  const refreshClients = useCallback(
    (selectSlug?: string) => {
      if (!key) return Promise.resolve()
      return fetch(`/api/admin/clients?key=${encodeURIComponent(key)}`)
        .then(async (r) => {
          if (r.status === 401) {
            setAuthError(true)
            throw new Error('Invalid admin key')
          }
          return r.json()
        })
        .then((data) => {
          const list = data.clients || []
          setClients(list)
          if (selectSlug) {
            const match = list.find((c: ClientWithStats) => c.slug === selectSlug)
            if (match) setSelectedClientId(match.id)
          } else if (!selectedClientId && list.length > 0) {
            setSelectedClientId(list[0].id)
          }
        })
        .catch(() => {})
    },
    [key, selectedClientId]
  )

  useEffect(() => {
    if (!key) {
      setLoading(false)
      setAuthError(true)
      return
    }
    refreshClients().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Fetch QR codes + reviews when client changes
  const fetchClientData = useCallback(
    (clientId: string) => {
      Promise.all([
        fetch(`/api/admin/qr-generate?key=${encodeURIComponent(key)}&client_id=${clientId}`).then((r) => r.json()),
        fetch(`/api/admin/reviews?key=${encodeURIComponent(key)}&client_id=${clientId}&limit=50`).then((r) => r.json()),
      ]).then(([qrData, reviewData]) => {
        setQrCodes(qrData.qr_codes || [])
        setReviews(reviewData.reviews || [])
      })
    },
    [key]
  )

  useEffect(() => {
    if (selectedClientId) {
      fetchClientData(selectedClientId)
    }
  }, [selectedClientId, fetchClientData])

  const handleGenerateQR = async () => {
    if (!selectedClientId || !qrLabel.trim()) {
      setToast({ message: 'Please enter a label first', type: 'error' })
      return
    }

    setGeneratingQR(true)
    try {
      const response = await fetch(`/api/admin/qr-generate?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: selectedClientId, label: qrLabel.trim() }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed')

      setNewQrPreview({
        data_url: data.qr_data_url,
        short_code: data.short_code,
        qr_url: data.qr_url,
      })
      setQrLabel('')
      fetchClientData(selectedClientId)
      setToast({ message: 'QR code generated!', type: 'success' })
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Failed', type: 'error' })
    } finally {
      setGeneratingQR(false)
    }
  }

  const downloadQR = (dataUrl: string, shortCode: string) => {
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `${shortCode}.png`
    link.click()
  }

  const copyText = (text: string, label = 'Copied') => {
    navigator.clipboard.writeText(text)
    setToast({ message: label, type: 'success' })
  }

  // ────────────────────────────────────────────────
  // Auth gate
  // ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="text-center py-20 text-white/50 font-sans">Loading…</div>
    )
  }

  if (authError) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <GlassCard className="text-center">
          <h1 className="font-serif text-2xl text-white mb-2 font-light">
            Admin Access Required
          </h1>
          <p className="text-white/50 text-sm font-sans mb-4">
            Add <code className="bg-white/10 px-2 py-0.5 rounded text-[#c9a87c]">?key=YOUR_ADMIN_SECRET</code> to the URL.
          </p>
          <p className="text-white/30 text-xs font-sans">
            The secret is set as <code className="bg-white/5 px-1 rounded">ADMIN_SECRET</code> in your environment variables.
          </p>
        </GlassCard>
      </div>
    )
  }

  const selectedClient = clients.find((c) => c.id === selectedClientId)
  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <>
      <header className="mb-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-serif text-3xl text-white font-light mb-1">
              <span className="text-[#a01b1b]">Seen</span>
              <span className="text-[#c9a87c]">AI</span>
              <span className="text-white/60 ml-3 text-2xl">Reviews Admin</span>
            </h1>
            <p className="text-white/40 text-sm font-sans">
              Manage clients, QR codes, and view reviews
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-white/30 text-xs font-sans">Total clients</div>
              <div className="text-[#c9a87c] text-2xl font-serif">{clients.length}</div>
            </div>
            <GlassButton onClick={() => setFormState({ mode: 'create', seed: null })}>
              + New Location
            </GlassButton>
          </div>
        </div>
      </header>

      {/* Locations grid */}
      <section className="mb-8">
        <h2 className="font-serif text-xl text-white/80 mb-4 font-light">Locations</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((c) => {
            const isSelected = c.id === selectedClientId
            return (
              <div
                key={c.id}
                className={`
                  relative text-left p-5 rounded-xl border transition-all
                  ${isSelected
                    ? 'bg-[#c9a87c]/10 border-[#c9a87c]/40 shadow-lg shadow-[#c9a87c]/10'
                    : 'bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/20'}
                `}
              >
                <button
                  onClick={() => setSelectedClientId(c.id)}
                  className="text-left w-full cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <div className="font-serif text-lg text-white font-light truncate pr-16">
                      {c.business_name}
                    </div>
                    {!c.is_active && (
                      <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded shrink-0">inactive</span>
                    )}
                  </div>
                  <div className="text-white/50 text-sm font-sans mb-3">{c.location_city}</div>
                  <div className="flex gap-3 text-xs font-sans">
                    <span className="text-[#c9a87c]">★ {c.stats.positive} positive</span>
                    <span className="text-red-400">⚠ {c.stats.negative} negative</span>
                  </div>
                  <div className="mt-3 text-white/30 text-xs font-mono truncate">/{c.slug}</div>
                </button>

                {/* Clone — opens New Location form pre-filled with brand fields */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setFormState({ mode: 'clone', seed: toSeed(c) })
                  }}
                  title="Clone brand to a new location"
                  className="absolute top-3 right-3 text-white/30 hover:text-[#c9a87c] text-xs font-sans px-2 py-1 rounded-md border border-white/10 hover:border-[#c9a87c]/40 bg-black/20 transition-colors"
                >
                  + Clone
                </button>
              </div>
            )
          })}
        </div>

        {clients.length === 0 && (
          <GlassCard className="text-center py-12">
            <p className="text-white/60 text-base font-sans mb-4">
              No clients yet. Add your first location to get started.
            </p>
            <GlassButton onClick={() => setFormState({ mode: 'create', seed: null })}>
              + Add First Location
            </GlassButton>
          </GlassCard>
        )}
      </section>

      {/* Selected client details */}
      {selectedClient && (
        <section className="mb-8">
          <GlassCard>
            <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
              <div>
                <h2 className="font-serif text-2xl text-white font-light">
                  {selectedClient.business_name} — {selectedClient.location_city}
                </h2>
                <p className="text-white/40 text-sm font-sans mt-1">
                  {selectedClient.location_address}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => setFormState({ mode: 'edit', seed: toSeed(selectedClient) })}
                  className="text-white/70 hover:text-[#c9a87c] text-sm font-sans transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => setFormState({ mode: 'clone', seed: toSeed(selectedClient) })}
                  className="text-white/70 hover:text-[#c9a87c] text-sm font-sans transition-colors"
                >
                  Clone
                </button>
                <a
                  href={`${appUrl}/${selectedClient.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#c9a87c] text-sm font-sans hover:underline"
                >
                  View funnel ↗
                </a>
              </div>
            </div>

            {/* Live URL — prominent + copyable */}
            <div className="mb-5 p-4 bg-gradient-to-r from-[#c9a87c]/10 to-[#a01b1b]/10 border border-[#c9a87c]/30 rounded-xl">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="text-[#c9a87c] text-xs font-sans uppercase tracking-widest mb-1">Live Funnel URL</p>
                  <p className="text-white text-base sm:text-lg font-mono break-all">
                    {appUrl}/{selectedClient.slug}
                  </p>
                </div>
                <button
                  onClick={() => copyText(`${appUrl}/${selectedClient.slug}`, 'URL copied — share with client')}
                  className="bg-[#c9a87c] hover:bg-[#e0c99a] text-[#0a0a0f] font-sans font-medium text-sm px-4 py-2 rounded-lg transition-all shrink-0"
                >
                  Copy URL
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <Stat label="Total" value={selectedClient.stats.total} />
              <Stat label="Positive" value={selectedClient.stats.positive} highlight="gold" />
              <Stat label="Negative" value={selectedClient.stats.negative} highlight="red" />
              <Stat label="QR Codes" value={qrCodes.length} />
            </div>

            <div className="space-y-2 text-sm font-sans border-t border-white/10 pt-4">
              <DetailRow label="Slug" value={`/${selectedClient.slug}`} onCopy={() => copyText(`${appUrl}/${selectedClient.slug}`, 'URL copied')} />
              <DetailRow label="Google Place ID" value={selectedClient.google_place_id} onCopy={() => copyText(selectedClient.google_place_id, 'Place ID copied')} />
              <DetailRow label="Notification email(s)" value={selectedClient.notification_email} />
              <DetailRow label="Services" value={selectedClient.services.join(', ')} />
              <DetailRow label="Team" value={selectedClient.team_members.join(', ')} />
            </div>
          </GlassCard>
        </section>
      )}

      {/* Tabs */}
      {selectedClient && (
        <section>
          <div className="flex gap-2 mb-4 border-b border-white/10">
            <TabButton active={activeTab === 'qr'} onClick={() => setActiveTab('qr')}>
              QR Codes
            </TabButton>
            <TabButton active={activeTab === 'reviews'} onClick={() => setActiveTab('reviews')}>
              Recent Reviews
            </TabButton>
          </div>

          {activeTab === 'qr' && (
            <div className="space-y-4">
              {/* QR Generator */}
              <GlassCard>
                <h3 className="font-serif text-xl text-white mb-3 font-light">Generate New QR Code</h3>
                <div className="flex gap-3">
                  <GlassInput
                    placeholder="Label (e.g. Front Desk, Treatment Room 1)"
                    value={qrLabel}
                    onChange={(e) => setQrLabel(e.target.value)}
                  />
                  <GlassButton onClick={handleGenerateQR} loading={generatingQR}>
                    Generate
                  </GlassButton>
                </div>

                {newQrPreview && (
                  <div className="mt-5 p-4 bg-black/20 rounded-xl border border-white/5 flex flex-col sm:flex-row items-start gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={newQrPreview.data_url}
                      alt="Generated QR code"
                      className="w-32 h-32 bg-white rounded-lg p-2"
                    />
                    <div className="flex-1">
                      <p className="text-white/80 text-sm font-sans mb-1">Short code: <code className="text-[#c9a87c]">{newQrPreview.short_code}</code></p>
                      <p className="text-white/50 text-xs font-mono mb-3 break-all">{newQrPreview.qr_url}</p>
                      <div className="flex gap-2">
                        <GlassButton variant="primary" onClick={() => downloadQR(newQrPreview.data_url, newQrPreview.short_code)}>
                          Download PNG
                        </GlassButton>
                        <GlassButton variant="secondary" onClick={() => copyText(newQrPreview.qr_url, 'URL copied')}>
                          Copy URL
                        </GlassButton>
                      </div>
                    </div>
                  </div>
                )}
              </GlassCard>

              {/* Existing QR codes */}
              <GlassCard>
                <h3 className="font-serif text-xl text-white mb-3 font-light">Existing QR Codes</h3>
                {qrCodes.length === 0 ? (
                  <p className="text-white/40 text-sm font-sans py-4">No QR codes yet. Generate your first one above.</p>
                ) : (
                  <div className="divide-y divide-white/5">
                    {qrCodes.map((qr) => (
                      <div key={qr.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-white/90 text-sm font-sans truncate">{qr.label || 'Unlabeled'}</div>
                          <div className="text-white/40 text-xs font-mono truncate">{qr.short_code}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[#c9a87c] text-lg font-serif">{qr.scan_count}</div>
                          <div className="text-white/30 text-xs font-sans">scans</div>
                        </div>
                        <button
                          onClick={() => copyText(`${appUrl}/q/${qr.short_code}`, 'URL copied')}
                          className="text-white/40 hover:text-[#c9a87c] text-xs font-sans transition-colors"
                        >
                          Copy URL
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            </div>
          )}

          {activeTab === 'reviews' && (
            <GlassCard>
              <h3 className="font-serif text-xl text-white mb-3 font-light">Recent Reviews</h3>
              {reviews.length === 0 ? (
                <p className="text-white/40 text-sm font-sans py-4">No reviews yet for this location.</p>
              ) : (
                <div className="divide-y divide-white/5">
                  {reviews.map((r) => (
                    <ReviewRowItem key={r.id} review={r} onCopy={(text) => copyText(text, 'Copied')} />
                  ))}
                </div>
              )}
            </GlassCard>
          )}
        </section>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {formState && (
        <NewClientForm
          adminKey={key}
          mode={formState.mode}
          seed={formState.seed}
          onClose={() => setFormState(null)}
          onSaved={(slug, savedMode) => {
            setFormState(null)
            refreshClients(slug)
            const verb = savedMode === 'edit' ? 'Saved' : 'Created'
            setToast({ message: `${verb} /${slug}`, type: 'success' })
          }}
        />
      )}
    </>
  )
}

// ────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: 'gold' | 'red' }) {
  const color = highlight === 'gold' ? 'text-[#c9a87c]' : highlight === 'red' ? 'text-red-400' : 'text-white'
  return (
    <div className="bg-white/5 rounded-xl p-3 text-center">
      <div className={`text-2xl font-serif ${color}`}>{value}</div>
      <div className="text-white/40 text-xs font-sans">{label}</div>
    </div>
  )
}

function DetailRow({ label, value, onCopy }: { label: string; value: string; onCopy?: () => void }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-white/40 shrink-0 w-32">{label}:</span>
      <span className="text-white/80 break-all flex-1">{value}</span>
      {onCopy && (
        <button onClick={onCopy} className="text-white/30 hover:text-[#c9a87c] text-xs shrink-0 transition-colors">
          copy
        </button>
      )}
    </div>
  )
}

function TabButton({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`
        px-4 py-2 font-sans text-sm transition-colors -mb-px border-b-2
        ${active ? 'text-[#c9a87c] border-[#c9a87c]' : 'text-white/40 border-transparent hover:text-white/70'}
      `}
    >
      {children}
    </button>
  )
}

function ReviewRowItem({ review, onCopy }: { review: ReviewRow; onCopy: (text: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const isPositive = review.review_type === 'positive'
  const stars = '★'.repeat(review.star_rating) + '☆'.repeat(5 - review.star_rating)
  const date = new Date(review.created_at).toLocaleString()
  const reviewText = isPositive ? review.generated_review : review.original_comments

  return (
    <div className="py-3">
      <div
        className="flex items-start justify-between cursor-pointer gap-3"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={isPositive ? 'text-[#c9a87c]' : 'text-red-400'}>{stars}</span>
            <span className="text-white/90 text-sm font-sans truncate">{review.customer_name}</span>
            {review.copied_to_clipboard && (
              <span className="text-xs bg-[#c9a87c]/10 text-[#c9a87c] px-1.5 py-0.5 rounded">copied</span>
            )}
            {review.redirected_to_google && (
              <span className="text-xs bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded">posted</span>
            )}
          </div>
          <div className="text-white/40 text-xs font-sans">
            {date} · {review.source} · {review.service_selected || '—'} · {review.team_member_selected || '—'}
          </div>
        </div>
        <span className="text-white/30 text-xs shrink-0">{expanded ? '−' : '+'}</span>
      </div>

      {expanded && (
        <div className="mt-3 pl-4 border-l-2 border-white/10 space-y-2 animate-fade-in">
          {(review.customer_email || review.customer_phone) && (
            <p className="text-xs font-sans text-white/50">
              Contact: {review.customer_email || review.customer_phone}
            </p>
          )}
          <div className="bg-black/20 rounded-lg p-3">
            <p className="text-white/80 text-sm font-sans whitespace-pre-wrap leading-relaxed">
              {reviewText || <em className="text-white/30">No review text</em>}
            </p>
          </div>
          {reviewText && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onCopy(reviewText)
              }}
              className="text-[#c9a87c] text-xs font-sans hover:underline"
            >
              Copy review text
            </button>
          )}
          {!isPositive && review.original_comments && (
            <p className="text-white/40 text-xs font-sans italic">
              ⚠ Bad review intercepted — alert email sent to notification address
            </p>
          )}
        </div>
      )}
    </div>
  )
}
