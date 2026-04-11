interface QRPrintableProps {
  qrImageUrl: string
  shortCode: string
  businessName?: string
  location?: string
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
  businessName = 'LovMedSpa',
  location = '1 Boerum Pl Suite 252, Brooklyn, NY',
  size = 'desk-card',
}: QRPrintableProps) {
  const { width, height, qrSize } = sizeStyles[size]

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
      {/* Brand Logo */}
      <div style={{ textAlign: 'center', marginBottom: '4px' }}>
        <span style={{ fontSize: '22px', fontFamily: 'Georgia, serif', fontWeight: 300 }}>
          <span style={{ color: '#a01b1b' }}>Lov</span>
          <span style={{ color: '#c9a87c' }}>MedSpa</span>
        </span>
      </div>

      {/* Call to action */}
      <p style={{ fontSize: '11px', color: '#6b7280', margin: 0, textAlign: 'center', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        Loved your visit?
      </p>

      {/* QR Code */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={qrImageUrl}
        alt={`QR code for ${businessName} reviews`}
        style={{
          width: qrSize,
          height: qrSize,
          imageRendering: 'pixelated',
        }}
      />

      {/* Headline */}
      <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0, textAlign: 'center' }}>
        Scan to share your experience
      </p>

      {/* Location */}
      <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0, textAlign: 'center' }}>
        {location}
      </p>

      {/* Short code (for debugging/reference) */}
      <p style={{ fontSize: '8px', color: '#d1d5db', margin: 0 }}>
        {shortCode}
      </p>

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
