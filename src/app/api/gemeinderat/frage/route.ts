import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api'
import { validate, gemeinderatFrageSchema } from '@/lib/validations'
import { sendeGemeinderatFrageEmail } from '@/lib/email'

/**
 * Benachrichtigt den adressierten Gemeinderat über eine neue Anfrage.
 *
 * Fehler werden bewusst nur geloggt: die Frage ist zu diesem Zeitpunkt bereits
 * gespeichert, ein Mailproblem darf dem Bürger keinen Fehler anzeigen.
 */
async function benachrichtigeGemeinderat(
  service: SupabaseClient,
  gemeinderatId: string,
  gemeindeId: string,
) {
  try {
    const [{ data: empfaenger }, { data: gemeinde }] = await Promise.all([
      // Anmelde-E-Mail aus auth.users, nicht die gepflegte Kontaktadresse
      // im Profil — die kann abweichen oder leer sein.
      service.auth.admin.getUserById(gemeinderatId),
      service.from('gemeinden').select('name, slug').eq('id', gemeindeId).single(),
    ])

    const to = empfaenger?.user?.email
    if (!to || !gemeinde) {
      console.error('[gemeinderat/frage] Benachrichtigung übersprungen', {
        gemeinderatId,
        hatEmail: !!to,
        hatGemeinde: !!gemeinde,
      })
      return
    }

    await sendeGemeinderatFrageEmail({
      to,
      gemeindeName: gemeinde.name,
      gemeindeSlug: gemeinde.slug,
    })
  } catch (e) {
    console.error('[gemeinderat/frage] E-Mail-Versand fehlgeschlagen', e)
  }
}

export const POST = withAuth(async (req, { user }) => {
  const body = await req.json()
  const v = validate(gemeinderatFrageSchema, body)
  if (!v.success) return v.error

  const service = await createServiceClient()
  const { error } = await service.from('gemeinderat_fragen').insert({
    gemeinde_id: v.data.gemeindeId,
    fragesteller_id: user.id,
    gemeinderat_id: v.data.gemeinderatId,
    frage: v.data.frage.trim(),
    status: 'offen',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await benachrichtigeGemeinderat(service, v.data.gemeinderatId, v.data.gemeindeId)

  return NextResponse.json({ ok: true })
})
