import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api'
import { validate, notificationSendSchema } from '@/lib/validations'
import { createClient } from '@/lib/supabase/server'

export const POST = withAuth(
  async (req, { profile }) => {
    const body = await req.json()
    const v = validate(notificationSendSchema, body)
    if (!v.success) return v.error

    const { title, message } = v.data

    const supabase = await createClient()
    const { data: gemeinde } = profile.gemeinde_id
      ? await supabase.from('gemeinden').select('slug').eq('id', profile.gemeinde_id).single()
      : { data: null }

    const res = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${process.env.ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
        filters: [
          { field: 'tag', key: 'gemeinde_slug', relation: '=', value: gemeinde?.slug ?? '' },
        ],
        headings: { de: title, en: title },
        contents: { de: message, en: message },
      }),
    })

    const data = await res.json()
    return NextResponse.json(data)
  },
  { roles: ['verwaltung', 'super_admin', 'gewerbe'] },
)
