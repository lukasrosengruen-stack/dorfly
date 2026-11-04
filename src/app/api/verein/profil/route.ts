import { withAuth, apiError } from '@/lib/api'
import { validate, vereinProfilErstellenSchema, vereinProfilAktualisierenSchema } from '@/lib/validations'
import { createServiceClient } from '@/lib/supabase/server'
import { meineMitgliedschaft, meinVereinsziel, rpcFehler } from '@/lib/mitgliedschaft'
import { NextResponse } from 'next/server'

// Selbstanlage: Person mit Rolle verein/organisation, die noch keinem Verein angehört.
export const POST = withAuth(
  async (req, { profile }) => {
    if (!profile.gemeinde_id) {
      return NextResponse.json({ error: 'Keine Gemeinde zugeordnet' }, { status: 400 })
    }

    const v = validate(vereinProfilErstellenSchema, await req.json())
    if (!v.success) return v.error

    const service = await createServiceClient()
    if (await meineMitgliedschaft(service, profile.id)) {
      return NextResponse.json({ error: 'Profil bereits vorhanden' }, { status: 409 })
    }

    const { data: vereinId, error: anlegeFehler } = await service.rpc('verein_anlegen', {
      p_profile_id: profile.id,
      p_typ: profile.role === 'organisation' ? 'organisation' : 'verein',
      p_name: v.data.verein_name,
      p_ausgefuehrt_von: profile.id,
    })
    if (anlegeFehler || !vereinId) {
      const f = rpcFehler(anlegeFehler ?? { message: 'kein Ergebnis' })
      return apiError(f.meldung, f.status)
    }

    const { data: verein, error } = await service
      .from('vereine')
      .update({
        kategorie_id: v.data.kategorie_id ?? null,
        beschreibung: v.data.beschreibung ?? null,
        website: v.data.website || null,
        logo_url: v.data.logo_url ?? null,
      })
      .eq('id', vereinId)
      .select()
      .single()

    if (error) {
      // Der Verein existiert schon (verein_anlegen ist durch). Ein Fehler hier darf
      // nicht wie „fehlgeschlagen“ aussehen, sonst endet der nächste Versuch mit 409.
      console.error('[verein/profil] Zusatzangaben nicht gespeichert:', error)
      const { data: angelegt } = await service.from('vereine').select().eq('id', vereinId).single()
      return NextResponse.json({
        verein: angelegt,
        warnung: 'Ihr Profil wurde angelegt, aber Logo, Beschreibung und Website konnten nicht gespeichert werden. Bitte ergänzen Sie sie unter „Profil“.',
      })
    }
    return NextResponse.json({ verein })
  },
  { roles: ['verein', 'organisation'] },
)

export const PATCH = withAuth(
  async (req, { profile }) => {
    const v = validate(vereinProfilAktualisierenSchema, await req.json())
    if (!v.success) return v.error

    const service = await createServiceClient()
    const m = await meinVereinsziel(service, profile.id, 'verein')
    if (!m || m.id !== v.data.vereinId) return apiError('Verein nicht gefunden', 404)
    if (m.rolle !== 'verwalter') return apiError('Nur Verwalter können das Profil bearbeiten.', 403)

    const { data: verein, error } = await service
      .from('vereine')
      .update({
        verein_name: v.data.verein_name,
        kategorie_id: v.data.kategorie_id ?? null,
        beschreibung: v.data.beschreibung ?? null,
        website: v.data.website || null,
        logo_url: v.data.logo_url ?? null,
      })
      .eq('id', m.id)
      .select()
      .single()

    if (error) {
      console.error('[verein/profil] DB-Fehler:', error)
      return apiError('Die Aktion ist fehlgeschlagen. Bitte versuchen Sie es erneut.', 500)
    }
    return NextResponse.json({ verein })
  },
  { roles: ['verein', 'organisation'] },
)
