import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api'
import { createServiceClient } from '@/lib/supabase/server'
import { parseIcs, ABFALL_TYP_CONFIG } from '@/lib/icsParser'

export const POST = withAuth(
  async (req: NextRequest, { profile }) => {
    if (!profile.gemeinde_id) {
      return NextResponse.json({ error: 'Keine Gemeinde zugewiesen' }, { status: 400 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'Keine Datei übermittelt' }, { status: 400 })
    }

    if (!file.name.toLowerCase().endsWith('.ics')) {
      return NextResponse.json({ error: 'Nur .ics-Dateien sind erlaubt' }, { status: 400 })
    }

    const content = await file.text()
    const { events, unbekannteTypen, fehler } = parseIcs(content)

    if (fehler) {
      return NextResponse.json({ error: fehler }, { status: 422 })
    }

    if (events.length === 0) {
      return NextResponse.json(
        { error: 'Keine gültigen Abfuhrtermine in der Datei gefunden', unbekannteTypen },
        { status: 422 },
      )
    }

    const service = await createServiceClient()
    const gemeindeId = profile.gemeinde_id

    // Alle bestehenden Termine dieser Gemeinde löschen (Re-Import ersetzt vollständig)
    const { error: deleteError } = await service
      .from('abfalltermine')
      .delete()
      .eq('gemeinde_id', gemeindeId)

    if (deleteError) {
      console.error('[abfallkalender/import] DELETE abfalltermine:', deleteError)
      return NextResponse.json({ error: 'Fehler beim Löschen alter Termine' }, { status: 500 })
    }

    // Neue Termine einfügen
    const rows = events.map(e => ({
      gemeinde_id: gemeindeId,
      typ: e.typ,
      datum: e.datum,
    }))

    const { error: insertError } = await service.from('abfalltermine').insert(rows)

    if (insertError) {
      return NextResponse.json({ error: 'Fehler beim Speichern der Termine' }, { status: 500 })
    }

    // Erkannte Abfallarten ermitteln
    const erkannteTypen = [...new Set(events.map(e => e.typ))]

    // Gemeinde-Einstellungen aktualisieren (upsert)
    await service.from('abfallkalender_einstellungen').upsert({
      gemeinde_id: gemeindeId,
      verfuegbare_typen: erkannteTypen,
      importiert_am: new Date().toISOString(),
      importiert_von: profile.display_name ?? 'Verwaltung',
      aktualisiert_am: new Date().toISOString(),
    })

    return NextResponse.json({
      ok: true,
      importiert: events.length,
      erkannteTypen: erkannteTypen.map(t => ABFALL_TYP_CONFIG[t]?.label ?? t),
      unbekannteTypen,
    })
  },
  { roles: ['verwaltung', 'super_admin'] },
)
