import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api'
import { validate, umfrageErstellenSchema, umfrageBearbeitenSchema } from '@/lib/validations'

const bearbeitenSchema = umfrageBearbeitenSchema.extend({
  fragen: umfrageErstellenSchema.shape.fragen.optional(),
})

export const POST = withAuth(
  async (req, { profile }) => {
    const body = await req.json()
    const v = validate(bearbeitenSchema, body)
    if (!v.success) return v.error

    const { id: umfrageId, titel, beschreibung, enddatum, fragen } = v.data
    const service = await createServiceClient()

    const { error: updateError } = await service
      .from('umfragen')
      .update({ titel, beschreibung: beschreibung ?? null, enddatum })
      .eq('id', umfrageId)
      .eq('gemeinde_id', profile.gemeinde_id!)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    if (fragen) {
      await service.from('umfrage_fragen').delete().eq('umfrage_id', umfrageId)

      for (const frage of fragen) {
        const { data: dbFrage, error: frageError } = await service
          .from('umfrage_fragen')
          .insert({ umfrage_id: umfrageId, reihenfolge: frage.reihenfolge, frage_text: frage.frage_text, typ: frage.typ })
          .select()
          .single()

        if (frageError || !dbFrage) return NextResponse.json({ error: frageError?.message ?? 'Fehler' }, { status: 500 })

        if (frage.umfrage_optionen?.length) {
          await service.from('umfrage_optionen').insert(
            frage.umfrage_optionen.map(o => ({ frage_id: dbFrage.id, reihenfolge: o.reihenfolge, option_text: o.option_text }))
          )
        }
      }
    }

    const { data: full } = await service
      .from('umfragen')
      .select('*, umfrage_fragen(*, umfrage_optionen(*))')
      .eq('id', umfrageId)
      .single()

    return NextResponse.json({ success: true, umfrage: full })
  },
  { roles: ['verwaltung', 'super_admin'] },
)
