import { Resend } from 'resend'
import type { Client, Review } from './types'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendNegativeFeedbackAlert(
  client: Client,
  review: Partial<Review> & {
    customer_name: string
    star_rating: number
    original_comments?: string
    contact?: string
  }
): Promise<void> {
  const stars = '★'.repeat(review.star_rating) + '☆'.repeat(5 - review.star_rating)
  const contactInfo = review.contact
    ? `<p><strong>Contact:</strong> ${escapeHtml(review.contact)}</p>`
    : '<p><em>No contact info provided</em></p>'

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #a01b1b; color: white; padding: 24px 32px; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 600; }
    .header p { margin: 4px 0 0; opacity: 0.85; font-size: 14px; }
    .body { padding: 32px; }
    .stars { font-size: 24px; color: #a01b1b; margin-bottom: 16px; }
    .feedback-box { background: #fef2f2; border-left: 4px solid #a01b1b; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 20px 0; }
    .feedback-box p { margin: 0; font-size: 15px; line-height: 1.6; color: #333; font-style: italic; }
    .meta { background: #f9f9f9; border-radius: 8px; padding: 16px 20px; margin-top: 20px; }
    .meta p { margin: 4px 0; font-size: 14px; color: #555; }
    .footer { padding: 20px 32px; border-top: 1px solid #eee; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Private Feedback Received</h1>
      <p>${escapeHtml(client.business_name)} — ${escapeHtml(client.location_city)}</p>
    </div>
    <div class="body">
      <div class="stars">${stars} (${review.star_rating}/5)</div>
      <p><strong>From:</strong> ${escapeHtml(review.customer_name)}</p>
      ${contactInfo}
      <div class="feedback-box">
        <p>${escapeHtml(review.original_comments || 'No written feedback provided')}</p>
      </div>
      <div class="meta">
        <p><strong>Submitted:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short' })} ET</p>
        <p><strong>Source:</strong> ${review.source || 'web'}</p>
      </div>
    </div>
    <div class="footer">
      <p>This feedback was submitted privately through your review funnel. The customer did not post publicly.</p>
    </div>
  </div>
</body>
</html>
`

  // Support multiple recipients — comma-separated in notification_email
  const recipients = client.notification_email
    .split(',')
    .map((e) => e.trim())
    .filter((e) => e.length > 0 && e.includes('@'))

  if (recipients.length === 0) {
    console.error('[email] No valid recipients for client', client.slug)
    return
  }

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'Reviews <onboarding@resend.dev>',
    to: recipients,
    subject: `${stars} Private Feedback from ${review.customer_name} — ${client.business_name} (${client.location_city})`,
    html,
  })
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
