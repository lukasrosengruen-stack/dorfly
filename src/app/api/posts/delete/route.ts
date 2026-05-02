import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api'
import { validate, postDeleteSchema } from '@/lib/validations'

export const DELETE = withAuth(
  async (req, { profile }) => {
    const body = await req.json()
    const v = validate(postDeleteSchema, body)
    if (!v.success) return v.error

    const isGemeinderat = profile.role === 'gemeinderat'
    const service = await createServiceClient()
    const { error } = await (isGemeinderat
      ? service.from('posts').delete().eq('id', v.data.id).eq('gemeinde_id', profile.gemeinde_id!).eq('author_id', profile.id)
      : service.from('posts').delete().eq('id', v.data.id).eq('gemeinde_id', profile.gemeinde_id!))

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  },
  { roles: ['verwaltung', 'super_admin', 'gemeinderat'] },
)
