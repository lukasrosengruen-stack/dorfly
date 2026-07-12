/**
 * Täglicher Cronjob: Abfallkalender-Benachrichtigungen
 *
 * Sendet Push-Notifications und E-Mails an Nutzer, die morgen eine Abfuhr haben.
 * Wird per Vercel Cron täglich um 18:00 Uhr MEZ aufgerufen (vercel.json).
 *
 * Hinweis: Die individuelle notificationTime je Nutzer wird gespeichert, aber da
 * der Cron einmal täglich feuert, richtet sich der Versandzeitpunkt nach der
 * Cron-Einstellung. Für per-Nutzer-Zeitsteuerung wäre eine Queue-Lösung nötig.
 *
 * Gesichert über CRON_SECRET Environment-Variable.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { ABFALL_TYP_CONFIG } from '@/lib/icsParser'
import type { AbfallTypSchluessel } from '@/lib/icsParser'
import { Resend } from 'resend'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = await createServiceClient()

  // Morgen-Datum berechnen
  const morgen = new Date()
  morgen.setDate(morgen.getDate() + 1)
  const morgenStr = morgen.toISOString().slice(0, 10) // 'YYYY-MM-DD'

  // Alle Nutzer mit aktivierten Präferenzen laden
  const { data: praeferenzen, error: praeferenzenError } = await service
    .from('abfallkalender_praeferenzen')
    .select('user_id, gemeinde_id, ausgewaehlte_typen, push_aktiviert, email_aktiviert')

  if (praeferenzenError || !praeferenzen) {
    console.error('[Abfallkalender Cron] Fehler beim Laden der Präferenzen:', praeferenzenError)
    return NextResponse.json({ error: 'Fehler beim Laden der Präferenzen' }, { status: 500 })
  }

  // Alle morgen anfallenden Termine laden (einmalig, dann per Code filtern)
  const { data: morgenTermine } = await service
    .from('abfalltermine')
    .select('gemeinde_id, typ')
    .eq('datum', morgenStr)

  if (!morgenTermine || morgenTermine.length === 0) {
    return NextResponse.json({ ok: true, versendet: 0, nachricht: 'Keine Termine morgen' })
  }

  // Gemeinde → Termintypen-Map aufbauen
  const termineByGemeinde = new Map<string, string[]>()
  for (const t of morgenTermine) {
    const existing = termineByGemeinde.get(t.gemeinde_id) ?? []
    termineByGemeinde.set(t.gemeinde_id, [...existing, t.typ])
  }

  // Gemeinde-Slugs für korrekte Notification-URLs laden
  const gemeindeIds = [...new Set(praeferenzen.map(p => p.gemeinde_id))]
  const { data: gemeinden } = await service
    .from('gemeinden')
    .select('id, slug')
    .in('id', gemeindeIds)
  const slugByGemeinde = new Map((gemeinden ?? []).map(g => [g.id, g.slug]))

  const userIds = praeferenzen.map(p => p.user_id)
  const { data: profiles } = await service
    .from('profiles')
    .select('id, display_name, email')
    .in('id', userIds)

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))

  let versendet = 0
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

  for (const pref of praeferenzen) {
    const termineGemeinde = termineByGemeinde.get(pref.gemeinde_id) ?? []
    if (termineGemeinde.length === 0) continue

    // Schnittmenge: Welche der ausgewählten Typen werden morgen abgeholt?
    const betroffeneTypen = (pref.ausgewaehlte_typen as string[]).filter(t =>
      termineGemeinde.includes(t),
    )
    if (betroffeneTypen.length === 0) continue

    const typLabels = betroffeneTypen.map(
      t => ABFALL_TYP_CONFIG[t as AbfallTypSchluessel]?.label ?? t,
    )

    // ── Push-Notification ────────────────────────────────────────────────────
    const gemeindeSlug = slugByGemeinde.get(pref.gemeinde_id) ?? ''
    if (pref.push_aktiviert) {
      for (const label of typLabels) {
        await sendPush(pref.user_id, label, gemeindeSlug)
      }
    }

    // ── E-Mail ───────────────────────────────────────────────────────────────
    if (pref.email_aktiviert && resend) {
      const email = profileMap.get(pref.user_id)?.email
      const displayName = profileMap.get(pref.user_id)?.display_name ?? 'Hallo'
      if (email) {
        await sendEmail(resend, email, displayName, typLabels)
      }
    }

    versendet++
  }

  return NextResponse.json({ ok: true, versendet, morgen: morgenStr })
}

// ─── Push über OneSignal (einzelner Nutzer via external_id) ──────────────────

async function sendPush(userId: string, abfallart: string, gemeindeSlug: string) {
  const nachricht = `Morgen wird ${abfallart} abgeholt. Tonne bitte bis 06:00 Uhr bereitstellen.`

  await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${process.env.ONESIGNAL_REST_API_KEY}`,
    },
    body: JSON.stringify({
      app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
      include_aliases: { external_id: [userId] },
      target_channel: 'push',
      headings: { de: 'Abfuhr-Erinnerung', en: 'Abfuhr-Erinnerung' },
      contents: { de: nachricht, en: nachricht },
      web_url: `https://${gemeindeSlug}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'dorfly.de'}/abfallkalender`,
      data: { pfad: '/abfallkalender' },
    }),
  }).catch(e => console.error('[Abfallkalender Cron] Push-Fehler:', e))
}

// ─── E-Mail über Resend ───────────────────────────────────────────────────────

async function sendEmail(resend: Resend, email: string, name: string, typen: string[]) {
  const typenHtml = typen
    .map(t => `<li><strong>${t}</strong></li>`)
    .join('')

  await resend.emails
    .send({
      from: `Dorfly <noreply@${process.env.RESEND_FROM_DOMAIN ?? 'dorfly.de'}>`,
      to: [email],
      subject: `Abfuhr-Erinnerung: morgen wird abgeholt`,
      html: `
        <p>Hallo ${name},</p>
        <p>morgen werden folgende Abfälle abgeholt:</p>
        <ul>${typenHtml}</ul>
        <p>Bitte stelle deine Tonne(n) bis <strong>06:00 Uhr</strong> bereit.</p>
        <p>Dein Dorfly-Team</p>
      `,
    })
    .catch(e => console.error('[Abfallkalender Cron] E-Mail-Fehler:', e))
}
