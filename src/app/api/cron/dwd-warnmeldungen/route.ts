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

  const { data: gemeinden, error } = await service
    .from('gemeinden')
    .select('id, slug, warncell_id')
    .not('warncell_id', 'is', null)

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
      const activeDwdIds = new Set(activeAlerts.map((a) => a.id))

      const { data: existingPosts } = await service
        .from('posts')
        .select('id, dwd_id, is_active')
        .eq('gemeinde_id', gemeinde.id)
        .eq('channel', 'warnung')
        .not('dwd_id', 'is', null)

      const existingDwdIds = new Set((existingPosts ?? []).map((p) => (p as any).dwd_id!))

      // Neue Warnungen anlegen
      for (const alert of activeAlerts) {
        if (existingDwdIds.has(alert.id)) continue

        const { titel, inhalt } = buildPostContent(alert)
        const { error: insertError } = await service.from('posts').insert({
          gemeinde_id: gemeinde.id,
          channel: 'warnung',
          titel,
          inhalt,
          dwd_id: alert.id,
          severity: SEVERITY_MAP[alert.severity],
          expires_at: alert.expires,
          is_active: true,
          pinned: true,
          status: 'published',
        } as any)

        if (!insertError) {
          await sendPushNotification(gemeinde.slug, titel)
          created++
        }
      }

      // Nicht mehr aktive DWD-Warnungen deaktivieren
      for (const post of existingPosts ?? []) {
        if (!(post as any).is_active) continue
        if (activeDwdIds.has((post as any).dwd_id!)) continue

        await service.from('posts').update({ is_active: false } as any).eq('id', post.id)
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
      headings: { de: 'Unwetterwarnung', en: 'Unwetterwarnung' },
      contents: { de: titel, en: titel },
      url: `${process.env.NEXT_PUBLIC_APP_URL}/warnmeldungen`,
    }),
  }).catch((e) => console.error('[DWD Cron] Push-Fehler:', e))
}
