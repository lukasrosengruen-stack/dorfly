import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api'
import { validate, umfrageAbstimmenSchema } from '@/lib/validations'

export const POST = withAuth(async (req, { user, profile }) => {
  const body = await req.json()
  const v = validate(umfrageAbstimmenSchema, body)
  if (!v.success) return v.error

  const { umfrageId, antworten } = v.data
  const service = await createServiceClient()

  // Umfrage aktiv und zur eigenen Gemeinde gehörig?
  const { data: umfrage } = await service
    .from('umfragen')
    .select('enddatum, gemeinde_id')
    .eq('id', umfrageId)
    .single()

  if (!umfrage || new Date(umfrage.enddatum) < new Date()) {
    return NextResponse.json({ error: 'Umfrage bereits beendet' }, { status: 400 })
  }

  if (umfrage.gemeinde_id !== profile.gemeinde_id) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  // Teilnahme zuerst: unique (umfrage_id, user_id) verhindert so auch bei zwei
  // gleichzeitigen Anfragen, dass dieselbe Person doppelt abstimmt.
  const { error: teilnahmeError } = await service
    .from('umfrage_teilnahmen')
    .insert({ umfrage_id: umfrageId, user_id: user.id })

  if (teilnahmeError) {
    if (teilnahmeError.code === '23505') {
      return NextResponse.json({ error: 'Bereits abgestimmt' }, { status: 409 })
    }
    console.error('[umfragen/abstimmen] Teilnahme nicht gespeichert:', teilnahmeError)
    return NextResponse.json({ error: 'Die Stimme konnte nicht gespeichert werden.' }, { status: 500 })
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
  if (antwortError) {
    console.error('[umfragen/abstimmen] Antworten nicht gespeichert:', antwortError)
    // Teilnahme zurücknehmen, damit die Person es erneut versuchen kann
    await service.from('umfrage_teilnahmen').delete().eq('umfrage_id', umfrageId).eq('user_id', user.id)
    return NextResponse.json({ error: 'Die Stimme konnte nicht gespeichert werden.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
})
