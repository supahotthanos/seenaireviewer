import { Suspense } from 'react'
import { supabaseServer } from '@/lib/supabase-server'
import AEOTester from './AEOTester'

export const metadata = {
  title: 'AEO Ranking Test — SeenAI',
  robots: { index: false, follow: false },
}

interface ClientLite {
  slug: string
  business_name: string
  location_city: string
  services: string[]
  aliases: string[]
}

export default async function AEOPage() {
  // Fetch active clients server-side so the tester can pre-populate
  // useful queries like "best <service> in <city>" + highlight
  // mentions of the business name.
  const { data } = await supabaseServer
    .from('clients')
    .select('slug, business_name, location_city, services, aliases')
    .eq('is_active', true)
    .order('business_name', { ascending: true })

  // Coerce aliases to an array (Postgres returns null for rows that
  // pre-date the column). The AEO tester auto-derives at runtime when
  // empty, so this is safe.
  const clients: ClientLite[] = ((data || []) as Array<Record<string, unknown>>).map((c) => ({
    slug: String(c.slug ?? ''),
    business_name: String(c.business_name ?? ''),
    location_city: String(c.location_city ?? ''),
    services: Array.isArray(c.services) ? (c.services as string[]) : [],
    aliases: Array.isArray(c.aliases) ? (c.aliases as string[]) : [],
  }))

  return (
    <main className="min-h-screen px-4 py-8 sm:py-12">
      <div className="max-w-5xl mx-auto">
        <Suspense fallback={<div className="text-white/60">Loading…</div>}>
          <AEOTester clients={clients} />
        </Suspense>
      </div>
    </main>
  )
}
