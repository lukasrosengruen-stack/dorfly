// src/app/api/cron/abfall-benachrichtigungen/route.ts
/**
 * Täglicher Cronjob: Abfallkalender-Benachrichtigungen
 *
 * Sendet Push-Notifications und E-Mails an Nutzer, die morgen eine Abfuhr
 * oder eine abonnierte Sammlung (Altpapier/Altkleider/Altglas/Schrott) haben.
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
import { SAMMLUNG_ART_CONFIG, sammlungPraeferenzSchluessel } from '@/lib/abfallkalenderSammlung'
import type { SammlungArtSchluessel } from '@/lib/abfallkalenderSammlung'
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
  const [{ data: morgenTermine }, { data: morgenSammlungen }] = await Promise.all([
    service.from('abfalltermine').select('gemeinde_id, typ').eq('datum', morgenStr),
    service
      .from('posts')
      .select('gemeinde_id, sammlung_art, sammlung_organisator')
      .eq('tag', 'sammlung')
      .eq('status', 'published')
      .eq('sammlung_datum', morgenStr),
  ])

  if ((!morgenTermine || morgenTermine.length === 0) && (!morgenSammlungen || morgenSammlungen.length === 0)) {
    return NextResponse.json({ ok: true, versendet: 0, nachricht: 'Keine Termine morgen' })
  }

  // Gemeinde → Termintypen-Map aufbauen
  const termineByGemeinde = new Map<string, string[]>()
  for (const t of morgenTermine ?? []) {
    const existing = termineByGemeinde.get(t.gemeinde_id) ?? []
    termineByGemeinde.set(t.gemeinde_id, [...existing, t.typ])
  }

  // Gemeinde → Sammlungen-Map aufbauen (Art + Organisator, mehrere pro Gemeinde möglich)
  const sammlungenByGemeinde = new Map<string, { art: SammlungArtSchluessel; organisator: string }[]>()
  for (const s of morgenSammlungen ?? []) {
    if (!s.sammlung_art) continue
    const existing = sammlungenByGemeinde.get(s.gemeinde_id) ?? []
    existing.push({ art: s.sammlung_art as SammlungArtSchluessel, organisator: s.sammlung_organisator ?? 'unbekannt' })
    sammlungenByGemeinde.set(s.gemeinde_id, existing)
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
    const sammlungenGemeinde = sammlungenByGemeinde.get(pref.gemeinde_id) ?? []

    const ausgewaehlteTypen = pref.ausgewaehlte_typen as string[]

    // Schnittmenge: Welche der ausgewählten Abfuhr-Typen werden morgen abgeholt?
    const betroffeneTypen = ausgewaehlteTypen.filter(t => termineGemeinde.includes(t))
    // Schnittmenge: Welche der ausgewählten Sammlungsarten finden morgen statt?
    const betroffeneSammlungen = sammlungenGemeinde.filter(s =>
      ausgewaehlteTypen.includes(sammlungPraeferenzSchluessel(s.art)),
    )

    if (betroffeneTypen.length === 0 && betroffeneSammlungen.length === 0) continue

    const abfuhrZeilen = betroffeneTypen.map(
      t => `${ABFALL_TYP_CONFIG[t as AbfallTypSchluessel]?.label ?? t} wird abgeholt`,
    )
    const sammlungZeilen = betroffeneSammlungen.map(
      s => `${SAMMLUNG_ART_CONFIG[s.art].label} (organisiert von ${s.organisator})`,
    )
    const alleZeilen = [...abfuhrZeilen, ...sammlungZeilen]

    // ── Push-Notification ────────────────────────────────────────────────────
    const gemeindeSlug = slugByGemeinde.get(pref.gemeinde_id) ?? ''
    if (pref.push_aktiviert) {
      for (const typ of betroffeneTypen) {
        const label = ABFALL_TYP_CONFIG[typ as AbfallTypSchluessel]?.label ?? typ
        await sendPush(pref.user_id, `Morgen wird ${label} abgeholt. Tonne bitte bis 06:00 Uhr bereitstellen.`, gemeindeSlug)
      }
      for (const s of betroffeneSammlungen) {
        const label = SAMMLUNG_ART_CONFIG[s.art].label
        await sendPush(pref.user_id, `Morgen findet die ${label} statt (organisiert von ${s.organisator}).`, gemeindeSlug)
      }
    }

    // ── E-Mail ───────────────────────────────────────────────────────────────
    if (pref.email_aktiviert && resend) {
      const email = profileMap.get(pref.user_id)?.email
      const displayName = profileMap.get(pref.user_id)?.display_name ?? 'Hallo'
      if (email) {
        await sendEmail(resend, email, displayName, alleZeilen)
      }
    }

    versendet++
  }

  return NextResponse.json({ ok: true, versendet, morgen: morgenStr })
}

// ─── Push über OneSignal (einzelner Nutzer via external_id) ──────────────────

async function sendPush(userId: string, nachricht: string, gemeindeSlug: string) {
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

async function sendEmail(resend: Resend, email: string, name: string, zeilen: string[]) {
  const zeilenHtml = zeilen
    .map(z => `<li><strong>${z}</strong></li>`)
    .join('')

  await resend.emails
    .send({
      from: `Dorfly <noreply@${process.env.RESEND_FROM_DOMAIN ?? 'dorfly.de'}>`,
      to: [email],
      subject: `Abfuhr-Erinnerung: morgen wird abgeholt`,
      html: `
        <p>Hallo ${name},</p>
        <p>morgen stehen folgende Termine an:</p>
        <ul>${zeilenHtml}</ul>
        <p>Bitte stelle deine Tonne(n) bis <strong>06:00 Uhr</strong> bereit, falls eine Abfuhr dabei ist.</p>
        <p>Dein Dorfly-Team</p>
      `,
    })
    .catch(e => console.error('[Abfallkalender Cron] E-Mail-Fehler:', e))
}
