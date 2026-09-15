import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api'
import { validate, frageUpdateSchema } from '@/lib/validations'
import { frageAntwortIstNeu, kuerzeFrage } from '@/lib/frageBenachrichtigung'
import { sendeBuergerfrageAntwortEmail } from '@/lib/email'
import { sendePushAnNutzer } from '@/lib/push'

/**
 * Benachrichtigt den Fragesteller über die Antwort der Verwaltung — per E-Mail
 * und, sofern Push aktiviert ist, zusätzlich per Push.
 *
 * Fehler werden bewusst nur geloggt: die Antwort ist zu diesem Zeitpunkt
 * bereits gespeichert, ein Zustellproblem darf der Verwaltung keinen Fehler
 * anzeigen.
 */
async function benachrichtigeFragesteller(
  service: SupabaseClient,
  frage: { fragesteller_id: string; gemeinde_id: string; frage: string },
  korrektur: boolean,
) {
  try {
    const [{ data: empfaenger }, { data: gemeinde }] = await Promise.all([
      // Anmelde-E-Mail aus auth.users, nicht die im Profil gepflegte
      // Kontaktadresse — die kann abweichen oder leer sein.
      service.auth.admin.getUserById(frage.fragesteller_id),
      service.from('gemeinden').select('name, slug').eq('id', frage.gemeinde_id).single(),
    ])

    if (!gemeinde) {
      console.error('[fragen/update] Benachrichtigung übersprungen: Gemeinde nicht gefunden', {
        gemeindeId: frage.gemeinde_id,
      })
      return
    }

    const to = empfaenger?.user?.email
    await Promise.all([
      to
        ? sendeBuergerfrageAntwortEmail({
            to,
            gemeindeName: gemeinde.name,
            gemeindeSlug: gemeinde.slug,
            frage: frage.frage,
            korrektur,
          })
        : Promise.resolve(
            console.error('[fragen/update] Keine E-Mail-Adresse zum Fragesteller gefunden', {
              fragestellerId: frage.fragesteller_id,
            }),
          ),
      // Geht ins Leere, wenn Push nie aktiviert wurde — das ist der gewollte
      // Opt-in, kein Fehlerfall.
      sendePushAnNutzer({
        userId: frage.fragesteller_id,
        titel: korrektur ? 'Ergänzte Antwort' : 'Antwort auf Ihre Frage',
        nachricht: `Die Verwaltung hat zu „${kuerzeFrage(frage.frage, 60)}“ geantwortet.`,
        pfad: '/buergermeister',
        gemeindeSlug: gemeinde.slug,
      }),
    ])
  } catch (e) {
    console.error('[fragen/update] Benachrichtigung fehlgeschlagen', e)
  }
}

export const PATCH = withAuth(
  async (req, { profile }) => {
    const body = await req.json()
    const v = validate(frageUpdateSchema, body)
    if (!v.success) return v.error

    const service = await createServiceClient()

    // Vorher-Zustand lesen: nur so lässt sich eine echte Änderung von einem
    // erneuten Speichern unterscheiden — und nur so ist der Fragesteller
    // überhaupt bekannt.
    const { data: vorher } = await service
      .from('fragen')
      .select('frage, antwort, fragesteller_id, gemeinde_id')
      .eq('id', v.data.id)
      .eq('gemeinde_id', profile.gemeinde_id!)
      .single()

    if (!vorher) return NextResponse.json({ error: 'Frage nicht gefunden' }, { status: 404 })

    const { error } = await service
      .from('fragen')
      .update({
        antwort: v.data.antwort,
        status: 'beantwortet',
        beantwortet_at: new Date().toISOString(),
      })
      .eq('id', v.data.id)
      .eq('gemeinde_id', profile.gemeinde_id!)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (frageAntwortIstNeu(vorher.antwort, v.data.antwort)) {
      // Stand vorher schon eine Antwort da, ist dies eine Korrektur — das
      // liest sich für den Fragesteller anders als eine erste Antwort.
      await benachrichtigeFragesteller(service, vorher, !!vorher.antwort?.trim())
    }

    return NextResponse.json({ ok: true })
  },
  { roles: ['verwaltung', 'super_admin'] },
)
