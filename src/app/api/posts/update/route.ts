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
    const service = await createServiceClient()
    const { error } = await service
      .from('posts')
      .update(fields)
      .eq('id', id)
      .eq('gemeinde_id', profile.gemeinde_id!)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  },
  { roles: ['verwaltung', 'super_admin'] },
)
