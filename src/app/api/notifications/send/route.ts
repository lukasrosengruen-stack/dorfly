import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api'
import { validate, notificationSendSchema } from '@/lib/validations'
import { createClient } from '@/lib/supabase/server'
import { ONESIGNAL_NOTIFICATIONS_URL, oneSignalHeaders, pushKonfig } from '@/lib/pushKonfig'

export const POST = withAuth(
  async (req, { profile }) => {
    const body = await req.json()
    const v = validate(notificationSendSchema, body)
    if (!v.success) return v.error

    const { title, message, url } = v.data

    const supabase = await createClient()
    const { data: gemeinde } = profile.gemeinde_id
      ? await supabase.from('gemeinden').select('slug').eq('id', profile.gemeinde_id).single()
      : { data: null }

    const push = pushKonfig()
    if (push.status === 'testumgebung') {
      console.info('[notifications/send] Testumgebung: Push nicht verschickt')
      return NextResponse.json({ ok: true, verschickt: false, grund: 'testumgebung' })
    }
    if (push.status === 'fehlt') {
      console.error('[notifications/send] OneSignal-Umgebungsvariablen fehlen')
      return NextResponse.json({ error: 'Push nicht konfiguriert' }, { status: 500 })
    }

    const res = await fetch(ONESIGNAL_NOTIFICATIONS_URL, {
      method: 'POST',
      headers: oneSignalHeaders(push),
      body: JSON.stringify({
        app_id: push.appId,
        filters: [
          { field: 'tag', key: 'gemeinde_slug', relation: '=', value: gemeinde?.slug ?? '' },
        ],
        headings: { de: title, en: title },
        contents: { de: message, en: message },
        ...(url && (() => {
          const pfad = url.startsWith('/') ? url : `/${url}`
          return {
            web_url: `${process.env.NEXT_PUBLIC_APP_URL}${pfad}`,
            data: { pfad },
          }
        })()),
      }),
    })

    const data = await res.json()
    return NextResponse.json(data)
  },
  { roles: ['verwaltung', 'super_admin'] },
)
