import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { UmfrageAntwort } from '@/types/umfrage'

export async function POST(req: NextRequest) {
  try {
    const { umfrageId, antworten } = await req.json() as {
      umfrageId: string
      antworten: UmfrageAntwort[]
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

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
    if (antwortError) throw antwortError

    // Teilnahme markieren
    await service.from('umfrage_teilnahmen').insert({ umfrage_id: umfrageId, user_id: user.id })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Fehler beim Abstimmen' }, { status: 500 })
  }
}
