import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api'
import { validate, gemeinderatFrageSchema } from '@/lib/validations'

export const POST = withAuth(async (req, { user }) => {
  const body = await req.json()
  const v = validate(gemeinderatFrageSchema, body)
  if (!v.success) return v.error

  const service = await createServiceClient()
  const { error } = await service.from('gemeinderat_fragen').insert({
    gemeinde_id: v.data.gemeindeId,
    fragesteller_id: user.id,
    gemeinderat_id: v.data.gemeinderatId,
    frage: v.data.frage.trim(),
    status: 'offen',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
})
