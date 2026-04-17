/* eslint-disable @next/next/no-img-element */
interface QRPrintableProps {
  qrImageUrl: string
  shortCode: string
  businessName: string
  location?: string
  brandColorPrimary?: string
  brandColorSecondary?: string
  logoUrl?: string | null
  size?: 'business-card' | 'desk-card' | 'sticker'
}

const sizeStyles = {
  'business-card': { width: '3.5in', height: '2in', qrSize: '1.2in' },
  'desk-card': { width: '6in', height: '4in', qrSize: '2.5in' },
  sticker: { width: '3in', height: '3in', qrSize: '2in' },
}

export function QRPrintable({
  qrImageUrl,
  shortCode,
  businessName,
  location,
  brandColorPrimary = '#c9a87c',
  brandColorSecondary = '#a01b1b',
  logoUrl,
  size = 'desk-card',
}: QRPrintableProps) {
  const { width, height, qrSize } = sizeStyles[size]

  // Smart wordmark split logic — same as BrandHeader
  function renderName() {
    if (logoUrl) {
      return (
        <img
          src={logoUrl}
          alt={businessName}
          style={{ height: '40px', width: 'auto', objectFit: 'contain' }}
        />
      )
    }

    if (!businessName.includes(' ')) {
      const camelMatch = businessName.match(/^([A-Z][a-z]+)([A-Z].*)/)
      if (camelMatch) {
        return (
          <span style={{ fontSize: '22px', fontFamily: 'Georgia, serif', fontWeight: 300 }}>
            <span style={{ color: brandColorSecondary }}>{camelMatch[1]}</span>
            <span style={{ color: brandColorPrimary }}>{camelMatch[2]}</span>
          </span>
        )
      }
      return (
        <span style={{ fontSize: '22px', fontFamily: 'Georgia, serif', fontWeight: 300, color: brandColorPrimary }}>
          {businessName}
        </span>
      )
    }

    const parts = businessName.split(' ')
    if (parts.length === 2) {
      return (
        <span style={{ fontSize: '22px', fontFamily: 'Georgia, serif', fontWeight: 300 }}>
          <span style={{ color: brandColorSecondary }}>{parts[0]}</span>{' '}
          <span style={{ color: brandColorPrimary }}>{parts[1]}</span>
        </span>
      )
    }

    return (
      <span style={{ fontSize: '20px', fontFamily: 'Georgia, serif', fontWeight: 300, color: brandColorPrimary }}>
        {businessName}
      </span>
    )
  }

  return (
    <div
      className="qr-printable"
      style={{
        width,
        height,
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: "'DM Sans', system-ui, sans-serif",
        gap: '12px',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '4px' }}>{renderName()}</div>

      <p style={{ fontSize: '11px', color: '#6b7280', margin: 0, textAlign: 'center', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        Loved your visit?
      </p>

      <img
        src={qrImageUrl}
        alt={`QR code for ${businessName} reviews`}
        style={{ width: qrSize, height: qrSize, imageRendering: 'pixelated' }}
      />

      <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0, textAlign: 'center' }}>
        Scan to share your experience
      </p>

      {location && (
        <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0, textAlign: 'center' }}>
          {location}
        </p>
      )}

      <p style={{ fontSize: '8px', color: '#d1d5db', margin: 0 }}>{shortCode}</p>

      <style>{`
        @media print {
          .qr-printable {
            border: none !important;
            box-shadow: none !important;
          }
          body {
            background: white !important;
          }
        }
      `}</style>
    </div>
  )
}
