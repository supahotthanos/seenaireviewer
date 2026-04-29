import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { unstable_cache } from 'next/cache'
import { supabaseServer } from '@/lib/supabase-server'
import ReviewFunnel from '@/components/ReviewFunnel'
import type { Client } from '@/lib/types'

interface ReviewPageProps {
  params: { clientSlug: string }
}

// Cache client lookups by slug for 60s. A customer scanning a QR typically
// hits the funnel multiple times as they navigate — cached reads keep the
// page instant after the first load, and clients that are edited in the
// admin show the new data within a minute.
const getClientBySlug = unstable_cache(
  async (slug: string) => {
    const { data } = await supabaseServer
      .from('clients')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()
    return data
  },
  ['client-by-slug'],
  { revalidate: 60, tags: ['clients'] }
)

export async function generateMetadata({ params }: ReviewPageProps): Promise<Metadata> {
  const client = await getClientBySlug(params.clientSlug)
  if (!client) return { title: 'Review' }
  return {
    title: `Share your experience at ${client.business_name}`,
    description: `Leave a review for ${client.business_name} in ${client.location_city}`,
    robots: { index: false, follow: false },
  }
}

export default async function ReviewPage({ params }: ReviewPageProps) {
  const client = await getClientBySlug(params.clientSlug)
  if (!client) notFound()

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Suspense fallback={null}>
          <ReviewFunnel client={client as Client} />
        </Suspense>
      </div>
    </main>
  )
}
