import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { UmfrageFrage } from '@/types/umfrage'

export async function POST(req: NextRequest) {
  try {
    const { umfrageId, titel, beschreibung, enddatum, fragen } = await req.json() as {
      umfrageId: string
      titel: string
      beschreibung: string
      enddatum: string
      fragen: (Omit<UmfrageFrage, 'id' | 'umfrage_id'> & { umfrage_optionen?: { option_text: string; reihenfolge: number }[] })[]
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

    const service = await createServiceClient()

    const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['verwaltung', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    // Basisdaten aktualisieren
    const { error: updateError } = await service
      .from('umfragen')
      .update({ titel, beschreibung: beschreibung || null, enddatum })
      .eq('id', umfrageId)
    if (updateError) throw new Error(updateError.message)

    // Alte Fragen + Optionen löschen und neu anlegen
    await service.from('umfrage_fragen').delete().eq('umfrage_id', umfrageId)

    for (const frage of fragen) {
      const { data: dbFrage, error: frageError } = await service
        .from('umfrage_fragen')
        .insert({ umfrage_id: umfrageId, reihenfolge: frage.reihenfolge, frage_text: frage.frage_text, typ: frage.typ })
        .select()
        .single()
      if (frageError) throw new Error(frageError.message)

      if (frage.umfrage_optionen?.length) {
        await service.from('umfrage_optionen').insert(
          frage.umfrage_optionen.map(o => ({ frage_id: dbFrage.id, reihenfolge: o.reihenfolge, option_text: o.option_text }))
        )
      }
    }

    const { data: full } = await service
      .from('umfragen')
      .select('*, umfrage_fragen(*, umfrage_optionen(*))')
      .eq('id', umfrageId)
      .single()

    return NextResponse.json({ success: true, umfrage: full })
  } catch (error) {
    console.error('Umfrage bearbeiten:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Fehler' }, { status: 500 })
  }
}
