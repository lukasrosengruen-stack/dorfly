import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.dorfly.de'

  if (!token) {
    return NextResponse.redirect(`${appUrl}/homepage?newsletter=fehler`)
  }

  const supabase = await createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db
    .from('newsletter_subscribers')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('confirmation_token', token)
    .eq('status', 'pending')

  if (error) {
    console.error('[api/newsletter/bestaetigen]', error)
    return NextResponse.redirect(`${appUrl}/homepage?newsletter=fehler`)
  }

  return NextResponse.redirect(`${appUrl}/homepage?newsletter=bestaetigt`)
}
