// src/app/api/cron/dwd-warnmeldungen/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchDwdAlerts, filterActiveAlerts, buildPostContent } from '@/features/warnmeldungen/dwd'
import { SEVERITY_MAP } from '@/features/warnmeldungen/types'
import { ONESIGNAL_NOTIFICATIONS_URL, oneSignalHeaders, pushKonfig } from '@/lib/pushKonfig'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = await createServiceClient()

  type GemeindeRow = { id: string; slug: string; warncell_id: string }
  const { data: gemeinden, error } = await (service.from('gemeinden') as any)
    .select('id, slug, warncell_id')
    .not('warncell_id', 'is', null) as { data: GemeindeRow[] | null; error: any }

  if (error) {
    console.error('[DWD Cron] Fehler beim Laden der Gemeinden:', error)
    return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 })
  }

  if (!gemeinden?.length) {
    return NextResponse.json({ ok: true, created: 0, deactivated: 0, message: 'Keine Gemeinden mit warncell_id' })
  }

  let created = 0
  let deactivated = 0

  for (const gemeinde of gemeinden) {
    try {
      const allAlerts = await fetchDwdAlerts(gemeinde.warncell_id!)
      const activeAlerts = filterActiveAlerts(allAlerts)
      const activeDwdIds = new Set(activeAlerts.map((a) => String(a.id)))

      type ExistingPostRow = { id: string; dwd_id: string | null; is_active: boolean }
      const { data: existingPosts } = await (service.from('posts') as any)
        .select('id, dwd_id, is_active')
        .eq('gemeinde_id', gemeinde.id)
        .eq('channel', 'warnung')
        .not('dwd_id', 'is', null) as { data: ExistingPostRow[] | null }

      const existingByDwdId = new Map((existingPosts ?? []).map((p) => [p.dwd_id!, p]))

      // Neue Warnungen anlegen
      for (const alert of activeAlerts) {
        const vorhanden = existingByDwdId.get(String(alert.id))
        if (vorhanden) {
          // Liefert die API einmal kurz keine Warnungen, deaktiviert der Lauf sie. Taucht
          // dieselbe Warnung wieder auf, wird sie still reaktiviert statt erneut gepusht.
          if (!vorhanden.is_active) {
            await service.from('posts').update({ is_active: true }).eq('id', vorhanden.id)
          }
          continue
        }

        const { titel, inhalt } = buildPostContent(alert)
        const { error: insertError } = await service.from('posts').insert({
          gemeinde_id: gemeinde.id,
          channel: 'warnung',
          titel,
          inhalt,
          dwd_id: String(alert.id),
          severity: SEVERITY_MAP[alert.severity] ?? 1,
          expires_at: alert.expires,
          is_active: true,
          pinned: true,
          status: 'published',
        } as any)

        if (!insertError) {
          await sendPushNotification(gemeinde.slug, titel)
          created++
        } else if (insertError.code === '23505') {
          // Ein paralleler Lauf hat die Warnung gerade angelegt (und gepusht):
          // posts_gemeinde_dwd_id_unique aus Migration 041 verhindert das Duplikat.
          continue
        } else {
          console.error(`[DWD Cron] Insert-Fehler für Gemeinde ${gemeinde.id}, dwd_id ${alert.id}:`, insertError)
        }
      }

      // Nicht mehr aktive DWD-Warnungen deaktivieren
      for (const post of existingPosts ?? []) {
        if (!post.is_active) continue
        if (activeDwdIds.has(post.dwd_id!)) continue

        await (service.from('posts') as any).update({ is_active: false }).eq('id', post.id)
        deactivated++
      }
    } catch (err) {
      console.error(`[DWD Cron] Fehler für Gemeinde ${gemeinde.id}:`, err)
    }
  }

  return NextResponse.json({ ok: true, created, deactivated })
}

async function sendPushNotification(gemeindeSlug: string, titel: string) {
  // Push ist Nebenwirkung: Die Warnung ist schon gespeichert, der Lauf gilt auch ohne Push als erfolgreich.
  const push = pushKonfig()
  if (push.status === 'testumgebung') return
  if (push.status === 'fehlt') {
    console.error('[DWD Cron] OneSignal-Umgebungsvariablen fehlen — Push übersprungen')
    return
  }
  await fetch(ONESIGNAL_NOTIFICATIONS_URL, {
    method: 'POST',
    headers: oneSignalHeaders(push),
    body: JSON.stringify({
      app_id: push.appId,
      filters: [{ field: 'tag', key: 'gemeinde_slug', relation: '=', value: gemeindeSlug }],
      headings: { de: 'DWD-Warnung', en: 'DWD-Warnung' },
      contents: { de: titel, en: titel },
      web_url: `https://${gemeindeSlug}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'dorfly.de'}/warnmeldungen`,
      data: { pfad: '/warnmeldungen' },
    }),
  }).catch((e) => console.error('[DWD Cron] Push-Fehler:', e))
}
