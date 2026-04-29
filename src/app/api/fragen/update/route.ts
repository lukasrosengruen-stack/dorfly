import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api'
import { validate, frageUpdateSchema } from '@/lib/validations'

export const PATCH = withAuth(
  async (req, { profile }) => {
    const body = await req.json()
    const v = validate(frageUpdateSchema, body)
    if (!v.success) return v.error

    const service = await createServiceClient()
    const { error } = await service
      .from('fragen')
      .update({
        antwort: v.data.antwort,
        status: 'beantwortet',
        beantwortet_at: new Date().toISOString(),
      })
      .eq('id', v.data.id)
      .eq('gemeinde_id', profile.gemeinde_id!)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  },
  { roles: ['verwaltung', 'super_admin'] },
)
