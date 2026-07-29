import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  }

  const { message, email, gemeindeId, gemeindeName } = await req.json()

  if (!message || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Feedback-Text fehlt' }, { status: 400 })
  }
  if (!gemeindeId || typeof gemeindeId !== 'string') {
    return NextResponse.json({ error: 'Gemeinde fehlt' }, { status: 400 })
  }
  if (email !== undefined && email !== '' && (typeof email !== 'string' || !EMAIL_REGEX.test(email))) {
    return NextResponse.json({ error: 'Ungültige E-Mail-Adresse' }, { status: 400 })
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('[api/feedback] RESEND_API_KEY nicht gesetzt')
    return NextResponse.json({ error: 'Versand aktuell nicht möglich' }, { status: 500 })
  }

  const safeMessage = escapeHtml(message.trim()).replace(/\n/g, '<br>')
  const safeGemeindeName = escapeHtml(String(gemeindeName ?? gemeindeId))
  const safeEmail = email ? escapeHtml(String(email)) : null

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'Dorfly Feedback <noreply@dorfly.de>',
      to: process.env.FEEDBACK_EMAIL || 'hallo@dorfly.de',
      replyTo: safeEmail ?? undefined,
      subject: `Feedback aus ${safeGemeindeName}`,
      html: `
        <h2 style="font-family:sans-serif;color:#0D1B2A;">Neues Feedback</h2>
        <table style="font-family:sans-serif;font-size:15px;border-collapse:collapse;width:100%;">
          <tr><td style="padding:8px 0;color:#64748B;width:140px;">Gemeinde</td><td style="padding:8px 0;font-weight:600;color:#0D1B2A;">${safeGemeindeName}</td></tr>
          ${safeEmail ? `<tr><td style="padding:8px 0;color:#64748B;">E-Mail</td><td style="padding:8px 0;"><a href="mailto:${safeEmail}" style="color:#0057A8;">${safeEmail}</a></td></tr>` : ''}
          <tr><td style="padding:8px 0;color:#64748B;vertical-align:top;">Feedback</td><td style="padding:8px 0;color:#0D1B2A;">${safeMessage}</td></tr>
        </table>
      `,
    })
  } catch (sendErr) {
    console.error('[api/feedback] Mailversand fehlgeschlagen:', sendErr)
    return NextResponse.json({ error: 'Versand fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
