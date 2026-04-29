import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api'
import { validate, umfrageAbstimmenSchema } from '@/lib/validations'

export const POST = withAuth(async (req, { user }) => {
  const body = await req.json()
  const v = validate(umfrageAbstimmenSchema, body)
  if (!v.success) return v.error

  const { umfrageId, antworten } = v.data
  const service = await createServiceClient()

  // Bereits abgestimmt?
  const { data: existing } = await service
    .from('umfrage_teilnahmen')
    .select('user_id')
    .eq('umfrage_id', umfrageId)
    .eq('user_id', user.id)
    .single()

  if (existing) return NextResponse.json({ error: 'Bereits abgestimmt' }, { status: 409 })

  // Umfrage noch aktiv?
  const { data: umfrage } = await service
    .from('umfragen')
    .select('enddatum')
    .eq('id', umfrageId)
    .single()

  if (!umfrage || new Date(umfrage.enddatum) < new Date()) {
    return NextResponse.json({ error: 'Umfrage bereits beendet' }, { status: 400 })
  }

  // Antworten speichern
  const rows = antworten.map(a => ({
    umfrage_id: umfrageId,
    frage_id: a.frage_id,
    user_id: user.id,
    antwort_text: a.antwort_text ?? null,
    option_id: a.option_id ?? null,
  }))

  const { error: antwortError } = await service.from('umfrage_antworten').insert(rows)
  if (antwortError) return NextResponse.json({ error: antwortError.message }, { status: 500 })

  // Teilnahme markieren
  await service.from('umfrage_teilnahmen').insert({ umfrage_id: umfrageId, user_id: user.id })

  return NextResponse.json({ success: true })
})
