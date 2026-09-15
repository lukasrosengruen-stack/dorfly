import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api'
import { validate, maengelStatusSchema } from '@/lib/validations'
import { mangelBenachrichtigung, naechsteNachricht, type MangelAenderung } from '@/lib/mangelBenachrichtigung'
import { sendeMangelUpdateEmail } from '@/lib/email'
import { sendePushAnNutzer } from '@/lib/push'
import type { MaengelStatus } from '@/types/database'

const STATUS_LABEL: Record<string, string> = {
  offen: 'Offen',
  in_bearbeitung: 'In Bearbeitung',
  erledigt: 'Erledigt',
}

/**
 * Benachrichtigt den Melder über ein Update seiner Meldung — per E-Mail und,
 * sofern Push aktiviert ist, zusätzlich per Push.
 *
 * Fehler werden bewusst nur geloggt: die Änderung ist zu diesem Zeitpunkt
 * bereits gespeichert, ein Zustellproblem darf der Verwaltung keinen Fehler
 * anzeigen.
 */
async function benachrichtigeMelder(
  service: SupabaseClient,
  mangel: { melder_id: string; gemeinde_id: string; titel: string },
  status: MaengelStatus,
  aenderung: MangelAenderung,
) {
  try {
    const [{ data: empfaenger }, { data: gemeinde }] = await Promise.all([
      // Anmelde-E-Mail aus auth.users, nicht die im Profil gepflegte
      // Kontaktadresse — die kann abweichen oder leer sein.
      service.auth.admin.getUserById(mangel.melder_id),
      service.from('gemeinden').select('name, slug').eq('id', mangel.gemeinde_id).single(),
    ])

    if (!gemeinde) {
      console.error('[maengel/status] Benachrichtigung übersprungen: Gemeinde nicht gefunden', {
        gemeindeId: mangel.gemeinde_id,
      })
      return
    }

    const statusLabel = STATUS_LABEL[status] ?? status
    const pushText = aenderung.statusGeaendert
      ? `„${mangel.titel}“ ist jetzt: ${statusLabel}`
      : `Die Verwaltung hat Ihnen zu „${mangel.titel}“ geantwortet.`

    const to = empfaenger?.user?.email
    await Promise.all([
      to
        ? sendeMangelUpdateEmail({
            to,
            gemeindeName: gemeinde.name,
            gemeindeSlug: gemeinde.slug,
            titel: mangel.titel,
            status,
            statusGeaendert: aenderung.statusGeaendert,
            nachrichtGeaendert: aenderung.nachrichtGeaendert,
          })
        : Promise.resolve(
            console.error('[maengel/status] Keine E-Mail-Adresse zum Melder gefunden', {
              melderId: mangel.melder_id,
            }),
          ),
      // Geht ins Leere, wenn der Melder Push nie aktiviert hat — das ist der
      // gewollte Opt-in, kein Fehlerfall.
      sendePushAnNutzer({
        userId: mangel.melder_id,
        titel: 'Update zu Ihrer Meldung',
        nachricht: pushText,
        pfad: '/maengel',
        gemeindeSlug: gemeinde.slug,
      }),
    ])
  } catch (e) {
    console.error('[maengel/status] Benachrichtigung fehlgeschlagen', e)
  }
}

// SICHERHEITSFIX: Route hatte vorher KEINE Authentifizierung!
export const POST = withAuth(
  async (req, { profile }) => {
    const body = await req.json()
    const v = validate(maengelStatusSchema, body)
    if (!v.success) return v.error

    const { mangelId, status, nachricht } = v.data
    const service = await createServiceClient()

    // Vorher-Zustand lesen: nur so lässt sich unterscheiden, ob sich wirklich
    // etwas geändert hat — und nur so ist der Melder überhaupt bekannt.
    const { data: vorher } = await service
      .from('maengel')
      .select('titel, status, nachricht_an_buerger, melder_id, gemeinde_id')
      .eq('id', mangelId)
      .eq('gemeinde_id', profile.gemeinde_id!)
      .single()

    if (!vorher) return NextResponse.json({ error: 'Meldung nicht gefunden' }, { status: 404 })

    const neueNachricht = naechsteNachricht(vorher.nachricht_an_buerger, nachricht)

    const { error } = await service
      .from('maengel')
      .update({
        status,
        nachricht_an_buerger: neueNachricht,
        status_updated_at: new Date().toISOString(),
      })
      .eq('id', mangelId)
      .eq('gemeinde_id', profile.gemeinde_id!)

    if (error) return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })

    const aenderung = mangelBenachrichtigung(
      { status: vorher.status, nachricht: vorher.nachricht_an_buerger },
      { status, nachricht: neueNachricht },
    )

    if (aenderung) {
      await benachrichtigeMelder(service, vorher, status, aenderung)
    }

    return NextResponse.json({ success: true })
  },
  { roles: ['verwaltung', 'super_admin'] },
)
