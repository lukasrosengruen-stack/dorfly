import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api'
import { validate, umfrageErstellenSchema } from '@/lib/validations'

export const POST = withAuth(
  async (req, { user }) => {
    const body = await req.json()
    const v = validate(umfrageErstellenSchema, body)
    if (!v.success) return v.error

    const { titel, beschreibung, enddatum, gemeindeId, fragen } = v.data
    const service = await createServiceClient()

    // Umfrage anlegen
    const { data: umfrage, error: umfrageError } = await service
      .from('umfragen')
      .insert({ titel, beschreibung: beschreibung ?? null, enddatum, gemeinde_id: gemeindeId, author_id: user.id })
      .select()
      .single()

    if (umfrageError || !umfrage) {
      return NextResponse.json({ error: umfrageError?.message ?? 'Fehler beim Erstellen' }, { status: 500 })
    }

    // Fragen anlegen
    for (const frage of fragen) {
      const { data: dbFrage, error: frageError } = await service
        .from('umfrage_fragen')
        .insert({ umfrage_id: umfrage.id, reihenfolge: frage.reihenfolge, frage_text: frage.frage_text, typ: frage.typ })
        .select()
        .single()

      if (frageError || !dbFrage) {
        return NextResponse.json({ error: frageError?.message ?? 'Frage konnte nicht erstellt werden' }, { status: 500 })
      }

      if (frage.umfrage_optionen?.length) {
        await service.from('umfrage_optionen').insert(
          frage.umfrage_optionen.map(o => ({ frage_id: dbFrage.id, reihenfolge: o.reihenfolge, option_text: o.option_text }))
        )
      }
    }

    const { data: full } = await service
      .from('umfragen')
      .select('*, umfrage_fragen(*, umfrage_optionen(*))')
      .eq('id', umfrage.id)
      .single()

    return NextResponse.json({ success: true, umfrage: full })
  },
  { roles: ['verwaltung', 'super_admin'] },
)
