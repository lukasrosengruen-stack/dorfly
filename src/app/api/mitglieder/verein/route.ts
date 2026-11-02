import { NextRequest, NextResponse } from 'next/server'
import { withAuth, apiError } from '@/lib/api'
import { createServiceClient } from '@/lib/supabase/server'
import { validate, vereinLoeschenSchema } from '@/lib/validations'
import { bestimmeZiel } from '@/lib/mitgliedschaft'
import { absenderFuer } from '@/lib/mitgliedHinzufuegen'
import { loescheVerein } from '@/lib/vereinLoeschen'
import { sendeRollenentzugEmail } from '@/lib/email'

// DELETE /api/mitglieder/verein — Verein, Organisation oder Gewerbe endgültig löschen.
// Bestätigung: der exakte Name muss mitgeschickt werden.
export const DELETE = withAuth(async (req: NextRequest, { profile }) => {
  const v = validate(vereinLoeschenSchema, await req.json())
  if (!v.success) return v.error

  const service = await createServiceClient()
  const ziel = await bestimmeZiel(service, profile, v.data)
  if (!ziel.ok) return apiError(ziel.fehler, ziel.status)

  if (v.data.bestaetigung.trim() !== ziel.ziel.name.trim()) {
    return apiError('Der eingegebene Name stimmt nicht überein.', 400)
  }

  const ergebnis = await loescheVerein(ziel.ziel, profile.id, service)
  if (!ergebnis.ok) {
    console.error('[verein-loeschen] abgebrochen', { profileId: profile.id, ziel: ziel.ziel, fehler: ergebnis.fehler })
    return apiError(ergebnis.fehler, ergebnis.status)
  }

  const { data: gemeinde } = await service.from('gemeinden').select('name').eq('id', ziel.ziel.gemeinde_id).single()
  for (const person of ergebnis.betroffene) {
    if (!person.email) continue
    try {
      await sendeRollenentzugEmail({
        to: person.email,
        name: person.name,
        gemeindeName: gemeinde?.name ?? '',
        alteRolle: ziel.ziel.typ,
        absender: absenderFuer(ziel.ziel),
        zusatz: `Der Eintrag „${ziel.ziel.name}“ wurde gelöscht.`,
      })
    } catch (e) {
      console.error('[verein-loeschen] Mail fehlgeschlagen:', e)
    }
  }

  return NextResponse.json({ ok: true })
}, { roles: ['verein', 'organisation', 'gewerbe', 'verwaltung', 'super_admin'] })
