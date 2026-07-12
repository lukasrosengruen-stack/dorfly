import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { warnmeldungSchema } from '@/app/(admin)/dashboard/warnmeldungen/schema'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, gemeinde_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'verwaltung') {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }
  if (!profile.gemeinde_id) {
    return NextResponse.json({ error: 'Keine Gemeinde zugewiesen' }, { status: 400 })
  }

  const body = await req.json()
  const parsed = warnmeldungSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Eingabe' }, { status: 400 })
  }

  const service = await createServiceClient()

  const { error: insertError } = await (service.from('posts') as any).insert({
    gemeinde_id: profile.gemeinde_id,
    author_id: user.id,
    channel: 'warnung',
    titel: parsed.data.titel,
    inhalt: parsed.data.inhalt,
    severity: parsed.data.severity,
    is_active: true,
    pinned: true,
    status: 'published',
  })

  if (insertError) {
    console.error('[Warnmeldung] Insert-Fehler:', insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  let pushWarning: string | undefined

  if (parsed.data.sendPush) {
    const { data: gemeinde } = await service
      .from('gemeinden')
      .select('slug')
      .eq('id', profile.gemeinde_id)
      .single()

    if (gemeinde) {
      const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'dorfly.de'
      const controller = new AbortController()
      const tid = setTimeout(() => controller.abort(), 5000)
      try {
        const pushRes = await fetch('https://onesignal.com/api/v1/notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Key ${process.env.ONESIGNAL_REST_API_KEY}`,
          },
          body: JSON.stringify({
            app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
            filters: [{ field: 'tag', key: 'gemeinde_slug', relation: '=', value: gemeinde.slug }],
            headings: { de: 'Warnmeldung', en: 'Warnmeldung' },
            contents: { de: parsed.data.titel, en: parsed.data.titel },
            url: `https://${gemeinde.slug}.${rootDomain}/warnmeldungen`,
          }),
          signal: controller.signal,
        })
        if (!pushRes.ok) {
          const body = await pushRes.text()
          console.error('[Warnmeldung] Push-Fehler HTTP', pushRes.status, body)
          pushWarning = `Push fehlgeschlagen (${pushRes.status})`
        }
      } catch (e) {
        console.error('[Warnmeldung] Push-Fehler:', e)
        pushWarning = 'Push konnte nicht gesendet werden'
      } finally {
        clearTimeout(tid)
      }
    }
  }

  return NextResponse.json({ success: true, ...(pushWarning && { pushWarning }) })
}
