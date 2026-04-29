import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSecret } from '@/lib/admin-auth'

// Tells the AEO tester which providers have a server-side key configured.
// Used to decide which provider tabs to enable + which models to include
// in batch runs. Admin-gated so we don't reveal configuration to the public.
export async function GET(request: NextRequest) {
  if (!verifyAdminSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({
    openai: Boolean(process.env.OPENAI_API_KEY?.trim()),
    google: Boolean(process.env.GOOGLE_AI_API_KEY?.trim()),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
  })
}
