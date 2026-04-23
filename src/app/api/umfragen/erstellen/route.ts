import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { UmfrageFrage } from '@/types/umfrage'

export async function POST(req: NextRequest) {
  try {
    const { titel, beschreibung, enddatum, gemeindeId, fragen } = await req.json() as {
      titel: string
      beschreibung: string
      enddatum: string
      gemeindeId: string
      fragen: (Omit<UmfrageFrage, 'id' | 'umfrage_id'> & { umfrage_optionen?: { option_text: string; reihenfolge: number }[] })[]
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

    const service = await createServiceClient()

    // Rolle prüfen
    const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['verwaltung', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    // Umfrage anlegen
    const { data: umfrage, error: umfrageError } = await service
      .from('umfragen')
      .insert({ titel, beschreibung: beschreibung || null, enddatum, gemeinde_id: gemeindeId, author_id: user.id })
      .select()
      .single()

    if (umfrageError) throw new Error(umfrageError.message)
    if (!umfrage) throw new Error('Umfrage konnte nicht erstellt werden')

    // Fragen anlegen
    for (const frage of fragen) {
      const { data: dbFrage, error: frageError } = await service
        .from('umfrage_fragen')
        .insert({ umfrage_id: umfrage.id, reihenfolge: frage.reihenfolge, frage_text: frage.frage_text, typ: frage.typ })
        .select()
        .single()

      if (frageError) throw new Error(frageError.message)
      if (!dbFrage) throw new Error('Frage konnte nicht erstellt werden')

      // Optionen anlegen
      if (frage.umfrage_optionen?.length) {
        await service.from('umfrage_optionen').insert(
          frage.umfrage_optionen.map(o => ({ frage_id: dbFrage.id, reihenfolge: o.reihenfolge, option_text: o.option_text }))
        )
      }
    }

    // Vollständige Umfrage zurückgeben
    const { data: full } = await service
      .from('umfragen')
      .select('*, umfrage_fragen(*, umfrage_optionen(*))')
      .eq('id', umfrage.id)
      .single()

    return NextResponse.json({ success: true, umfrage: full })
  } catch (error) {
    console.error('Umfrage erstellen Fehler:', error)
    const msg = error instanceof Error ? error.message : (error as { message?: string })?.message ?? 'Fehler beim Erstellen'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
