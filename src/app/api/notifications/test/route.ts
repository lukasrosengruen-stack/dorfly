import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

export async function POST() {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const results: Record<string, string> = {}

  // ── Push via OneSignal ────────────────────────────────────────────────────
  if (!process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || !process.env.ONESIGNAL_REST_API_KEY) {
    results.push = 'FEHLER: OneSignal-Umgebungsvariablen fehlen'
  } else {
    const pushRes = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${process.env.ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
        include_aliases: { external_id: [user.id] },
        target_channel: 'push',
        headings: { de: 'Test-Benachrichtigung', en: 'Test-Benachrichtigung' },
        contents: { de: 'Push-Benachrichtigungen funktionieren!', en: 'Push-Benachrichtigungen funktionieren!' },
      }),
    })
    const pushData = await pushRes.json()
    results.push = pushRes.ok ? 'OK' : `FEHLER: ${JSON.stringify(pushData)}`
  }

  // ── E-Mail via Resend ─────────────────────────────────────────────────────
  const email = user.email
  if (!email) {
    results.email = 'FEHLER: Kein E-Mail-Adresse im Account hinterlegt'
  } else if (!process.env.RESEND_API_KEY) {
    results.email = 'FEHLER: RESEND_API_KEY fehlt'
  } else {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const service = await createServiceClient()
    const { data: profile } = await service
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()

    const { error: emailError } = await resend.emails.send({
      from: `Dorfly <noreply@${process.env.RESEND_FROM_DOMAIN ?? 'dorfly.de'}>`,
      to: [email],
      subject: 'Test: Abfallkalender-Benachrichtigung',
      html: `<p>Hallo ${profile?.display_name ?? ''},</p><p>diese Test-E-Mail bestätigt, dass E-Mail-Benachrichtigungen funktionieren.</p><p>Dein Dorfly-Team</p>`,
    })
    results.email = emailError ? `FEHLER: ${emailError.message}` : `OK (an ${email})`
  }

  return NextResponse.json({ userId: user.id, email: user.email, results })
}
