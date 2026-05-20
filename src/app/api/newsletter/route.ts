import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { randomUUID } from 'crypto'

export async function POST(req: Request) {
  try {
    const { vorname, nachname, email, gemeinde } = await req.json()

    if (!vorname || !nachname || !email) {
      return NextResponse.json({ error: 'Pflichtfelder fehlen.' }, { status: 400 })
    }

    const token = randomUUID()
    const supabase = await createServiceClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data: existing } = await db
      .from('newsletter_subscribers')
      .select('id, status')
      .eq('email', email.toLowerCase())
      .single()

    if (existing) {
      if (existing.status === 'confirmed') {
        return NextResponse.json({ ok: true })
      }
      await db
        .from('newsletter_subscribers')
        .update({ confirmation_token: token, first_name: vorname, last_name: nachname, municipality: gemeinde || null })
        .eq('id', existing.id)
    } else {
      const { error } = await db.from('newsletter_subscribers').insert({
        email: email.toLowerCase(),
        first_name: vorname,
        last_name: nachname,
        municipality: gemeinde || null,
        status: 'pending',
        confirmation_token: token,
      })
      if (error) throw error
    }

    const confirmUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/newsletter/bestaetigen?token=${token}`

    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: 'Dorfly <noreply@dorfly.de>',
        to: email,
        subject: 'Bitte bestätigen Sie Ihre Anmeldung',
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#0D1B2A;">
            <h2 style="font-size:22px;font-weight:800;letter-spacing:-0.03em;margin-bottom:8px;">Hallo ${vorname},</h2>
            <p style="color:#64748B;line-height:1.65;margin-bottom:28px;">
              bitte bestätigen Sie Ihre E-Mail-Adresse, um Updates zu Dorfly zu erhalten.
            </p>
            <a href="${confirmUrl}"
               style="display:inline-block;padding:14px 28px;background:#0057A8;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;">
              E-Mail-Adresse bestätigen
            </a>
            <p style="color:#94A3B8;font-size:12px;margin-top:32px;line-height:1.6;">
              Falls Sie sich nicht angemeldet haben, können Sie diese E-Mail ignorieren.
            </p>
          </div>
        `,
      })
    } else {
      console.log('[Newsletter] Bestätigungslink:', confirmUrl)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/newsletter]', err)
    return NextResponse.json({ error: 'Serverfehler.' }, { status: 500 })
  }
}
