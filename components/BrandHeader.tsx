/* eslint-disable @next/next/no-img-element */
import type { Client } from '@/lib/types'

interface BrandHeaderProps {
  client: Pick<Client, 'business_name' | 'location_address' | 'brand_color_primary' | 'brand_color_secondary' | 'logo_url'>
  showAddress?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: { text: 'text-2xl', logo: 'h-10' },
  md: { text: 'text-4xl', logo: 'h-14' },
  lg: { text: 'text-5xl', logo: 'h-20' },
}

/**
 * Renders the business name as a styled wordmark.
 * Two-tone split logic (matches LovMedSpa-style branding):
 * 1. CamelCase split — "LovMedSpa" → "Lov" + "MedSpa"
 * 2. Two-word split — "Glow Aesthetics" → "Glow" + "Aesthetics"
 * 3. Otherwise — solid color
 */
function renderWordmark(name: string, primary: string, secondary: string) {
  // CamelCase split — name with no space but has multiple capitals
  if (!name.includes(' ')) {
    const camelMatch = name.match(/^([A-Z][a-z]+)([A-Z].*)/)
    if (camelMatch) {
      return (
        <>
          <span style={{ color: secondary }}>{camelMatch[1]}</span>
          <span style={{ color: primary }}>{camelMatch[2]}</span>
        </>
      )
    }
    return <span style={{ color: primary }}>{name}</span>
  }

  // Two-word split — color first word secondary, rest primary
  const parts = name.split(' ')
  if (parts.length === 2) {
    return (
      <>
        <span style={{ color: secondary }}>{parts[0]}</span>{' '}
        <span style={{ color: primary }}>{parts[1]}</span>
      </>
    )
  }

  // Three+ words — solid primary, simpler reads better
  return <span style={{ color: primary }}>{name}</span>
}

export function BrandHeader({ client, showAddress = true, size = 'md' }: BrandHeaderProps) {
  const sizes = sizeMap[size]
  const primary = client.brand_color_primary || '#c9a87c'
  const secondary = client.brand_color_secondary || '#a01b1b'

  return (
    <div className="text-center mb-8">
      <div className="mb-3 flex items-center justify-center">
        {client.logo_url ? (
          <img
            src={client.logo_url}
            alt={client.business_name}
            className={`${sizes.logo} w-auto object-contain`}
          />
        ) : (
          <span className={`font-serif ${sizes.text} font-light tracking-wide`}>
            {renderWordmark(client.business_name, primary, secondary)}
          </span>
        )}
      </div>
      {showAddress && client.location_address && (
        <p className="text-[color:var(--text-muted)] text-sm font-sans">{client.location_address}</p>
      )}
    </div>
  )
}
