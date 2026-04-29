import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api'
import { validate, notificationSendSchema } from '@/lib/validations'

export const POST = withAuth(
  async (req) => {
    const body = await req.json()
    const v = validate(notificationSendSchema, body)
    if (!v.success) return v.error

    const { title, message } = v.data

    const res = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${process.env.ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
        included_segments: ['All'],
        headings: { de: title, en: title },
        contents: { de: message, en: message },
      }),
    })

    const data = await res.json()
    return NextResponse.json(data)
  },
  { roles: ['verwaltung', 'super_admin'] },
)
