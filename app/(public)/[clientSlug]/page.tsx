import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { supabaseServer } from '@/lib/supabase-server'
import ReviewFunnel from '@/components/ReviewFunnel'
import type { Client } from '@/lib/types'

interface ReviewPageProps {
  params: { clientSlug: string }
}

export async function generateMetadata({ params }: ReviewPageProps): Promise<Metadata> {
  const { data: client } = await supabaseServer
    .from('clients')
    .select('business_name, location_city')
    .eq('slug', params.clientSlug)
    .eq('is_active', true)
    .single()

  if (!client) {
    return { title: 'Review' }
  }

  return {
    title: `Share your experience at ${client.business_name}`,
    description: `Leave a review for ${client.business_name} in ${client.location_city}`,
    robots: { index: false, follow: false },
  }
}

export default async function ReviewPage({ params }: ReviewPageProps) {
  const { data: client, error } = await supabaseServer
    .from('clients')
    .select('*')
    .eq('slug', params.clientSlug)
    .eq('is_active', true)
    .single()

  if (error || !client) {
    notFound()
  }

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
