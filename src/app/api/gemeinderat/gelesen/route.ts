import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api'

/**
 * Markiert Gemeinderats-Nachrichten als gelesen.
 *
 * Wird beim Öffnen des jeweiligen Bereichs aufgerufen — vom Bürger im Tab
 * "Meine Fragen", vom Gemeinderat im Dashboard. Welche Spalte gesetzt wird,
 * leitet sich serverseitig aus der Rolle des Aufrufers ab; der Client kann
 * das nicht beeinflussen.
 *
 * Läuft über service_role, weil die RLS-Policy "gemeinderat_fragen_beantworten"
 * UPDATE nur dem adressierten Gemeinderat erlaubt — der Fragesteller könnte
 * sein eigenes Lese-Flag sonst nicht setzen. Die WHERE-Klauseln unten binden
 * den Schreibzugriff strikt an die eigene User-ID.
 */
export const POST = withAuth(async (_req, { user, profile }) => {
  const service = await createServiceClient()
  const jetzt = new Date().toISOString()

  const query = profile.role === 'gemeinderat'
    ? service
        .from('gemeinderat_fragen')
        .update({ gelesen_von_rat_at: jetzt })
        .eq('gemeinderat_id', user.id)
        .is('gelesen_von_rat_at', null)
    : service
        .from('gemeinderat_fragen')
        .update({ gelesen_von_buerger_at: jetzt })
        .eq('fragesteller_id', user.id)
        .is('gelesen_von_buerger_at', null)
        // Solange keine Antwort da ist, gibt es für den Bürger nichts zu lesen.
        .eq('status', 'beantwortet')

  const { error } = await query

  if (error) {
    console.error('[gemeinderat/gelesen] Update fehlgeschlagen', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
})
