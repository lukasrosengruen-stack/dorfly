import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api'
import { validate, gemeinderatAntwortSchema } from '@/lib/validations'
import { sendeGemeinderatAntwortEmail } from '@/lib/email'

/**
 * Benachrichtigt den Fragesteller über eine neue Antwort.
 *
 * Fehler werden bewusst nur geloggt: die Antwort ist zu diesem Zeitpunkt bereits
 * gespeichert, ein Mailproblem darf dem Gemeinderat keinen Fehler anzeigen.
 */
async function benachrichtigeFragesteller(
  service: SupabaseClient,
  fragestellerId: string,
  gemeindeId: string,
) {
  try {
    const [{ data: empfaenger }, { data: gemeinde }] = await Promise.all([
      // Anmelde-E-Mail aus auth.users, nicht die im Profil gepflegte
      // Kontaktadresse — die kann abweichen oder leer sein.
      service.auth.admin.getUserById(fragestellerId),
      service.from('gemeinden').select('name, slug').eq('id', gemeindeId).single(),
    ])

    const to = empfaenger?.user?.email
    if (!to || !gemeinde) {
      console.error('[gemeinderat/antwort] Benachrichtigung übersprungen', {
        fragestellerId,
        hatEmail: !!to,
        hatGemeinde: !!gemeinde,
      })
      return
    }

    await sendeGemeinderatAntwortEmail({
      to,
      gemeindeName: gemeinde.name,
      gemeindeSlug: gemeinde.slug,
    })
  } catch (e) {
    console.error('[gemeinderat/antwort] E-Mail-Versand fehlgeschlagen', e)
  }
}

export const PATCH = withAuth(
  async (req, { user }) => {
    const body = await req.json()
    const v = validate(gemeinderatAntwortSchema, body)
    if (!v.success) return v.error

    const service = await createServiceClient()

    // Verifizieren dass dieser Gemeinderat die Frage besitzt
    const { data: frage } = await service
      .from('gemeinderat_fragen')
      .select('gemeinderat_id, fragesteller_id, gemeinde_id')
      .eq('id', v.data.frageId)
      .single()

    if (!frage || frage.gemeinderat_id !== user.id) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    const { error } = await service
      .from('gemeinderat_fragen')
      .update({
        antwort: v.data.antwort.trim(),
        status: 'beantwortet',
        // Neue Antwort → für den Bürger wieder ungelesen.
        gelesen_von_buerger_at: null,
      })
      .eq('id', v.data.frageId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await benachrichtigeFragesteller(service, frage.fragesteller_id, frage.gemeinde_id)

    return NextResponse.json({ ok: true })
  },
  { roles: ['gemeinderat'] },
)
