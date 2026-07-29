// src/app/api/cron/dwd-warnmeldungen/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchDwdAlerts, filterActiveAlerts, buildPostContent } from '@/features/warnmeldungen/dwd'
import { SEVERITY_MAP } from '@/features/warnmeldungen/types'

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

      const existingDwdIds = new Set((existingPosts ?? []).map((p) => p.dwd_id!))

      // Neue Warnungen anlegen
      for (const alert of activeAlerts) {
        if (existingDwdIds.has(String(alert.id))) continue

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
  await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${process.env.ONESIGNAL_REST_API_KEY}`,
    },
    body: JSON.stringify({
      app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
      filters: [{ field: 'tag', key: 'gemeinde_slug', relation: '=', value: gemeindeSlug }],
      headings: { de: 'DWD-Warnung', en: 'DWD-Warnung' },
      contents: { de: titel, en: titel },
      web_url: `https://${gemeindeSlug}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'dorfly.de'}/warnmeldungen`,
      data: { pfad: '/warnmeldungen' },
    }),
  }).catch((e) => console.error('[DWD Cron] Push-Fehler:', e))
}
