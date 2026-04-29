import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api'
import { validate, gemeinderatAntwortSchema } from '@/lib/validations'

export const PATCH = withAuth(
  async (req, { user }) => {
    const body = await req.json()
    const v = validate(gemeinderatAntwortSchema, body)
    if (!v.success) return v.error

    const service = await createServiceClient()

    // Verifizieren dass dieser Gemeinderat die Frage besitzt
    const { data: frage } = await service
      .from('gemeinderat_fragen')
      .select('gemeinderat_id')
      .eq('id', v.data.frageId)
      .single()

    if (!frage || frage.gemeinderat_id !== user.id) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    const { error } = await service
      .from('gemeinderat_fragen')
      .update({ antwort: v.data.antwort.trim(), status: 'beantwortet' })
      .eq('id', v.data.frageId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  },
  { roles: ['gemeinderat'] },
)
