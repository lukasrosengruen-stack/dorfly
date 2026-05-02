import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api'
import { validate, postUpdateSchema } from '@/lib/validations'

export const PATCH = withAuth(
  async (req, { profile }) => {
    const body = await req.json()
    const v = validate(postUpdateSchema, body)
    if (!v.success) return v.error

    const { id, ...fields } = v.data
    const isGemeinderat = profile.role === 'gemeinderat'
    const updateFields = isGemeinderat ? { ...fields, status: 'pending' as const } : fields

    const service = await createServiceClient()
    const { error } = await (isGemeinderat
      ? service.from('posts').update(updateFields).eq('id', id).eq('gemeinde_id', profile.gemeinde_id!).eq('author_id', profile.id)
      : service.from('posts').update(updateFields).eq('id', id).eq('gemeinde_id', profile.gemeinde_id!))

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  },
  { roles: ['verwaltung', 'super_admin', 'gemeinderat'] },
)
