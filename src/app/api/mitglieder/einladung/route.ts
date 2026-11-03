import { NextRequest, NextResponse } from 'next/server'
import { withAuth, apiError } from '@/lib/api'
import { createServiceClient } from '@/lib/supabase/server'
import { validate, mitgliedEinladungZurueckziehenSchema } from '@/lib/validations'
import { bestimmeZiel } from '@/lib/mitgliedschaft'

// DELETE /api/mitglieder/einladung — offene Einladung in den eigenen Verein zurückziehen
export const DELETE = withAuth(async (req: NextRequest, { profile }) => {
  const v = validate(mitgliedEinladungZurueckziehenSchema, await req.json())
  if (!v.success) return v.error

  const service = await createServiceClient()
  const ziel = await bestimmeZiel(service, profile, v.data)
  if (!ziel.ok) return apiError(ziel.fehler, ziel.status)
  if (ziel.ziel.recht === 'autor') return apiError('Nur Verwalter können Einladungen zurückziehen.', 403)

  const zielId = (ziel.ziel.verein_id ?? ziel.ziel.organisation_id)!

  const { data, error } = await service
    .from('einladungen')
    .update({ status: 'widerrufen' })
    .eq('id', v.data.einladung_id)
    .eq(ziel.ziel.verein_id ? 'verein_id' : 'org_id', zielId)
    .eq('status', 'offen')
    .select('email')
    .maybeSingle()

  if (error) {
    console.error('[mitglieder/einladung] Widerrufen fehlgeschlagen:', error)
    return apiError('Die Einladung konnte nicht zurückgezogen werden.')
  }
  if (!data) return apiError('Einladung nicht gefunden', 404)

  const { error: logFehler } = await service.from('rollen_log').insert({
    gemeinde_id: ziel.ziel.gemeinde_id,
    aktion: 'widerrufen',
    ziel_email: data.email,
    einladung_id: v.data.einladung_id,
    ausgefuehrt_von: profile.id,
  })
  if (logFehler) console.error('[mitglieder/einladung] rollen_log (widerrufen) fehlgeschlagen:', logFehler)

  return NextResponse.json({ ok: true })
}, { roles: ['verein', 'organisation', 'gewerbe', 'verwaltung', 'super_admin'] })
