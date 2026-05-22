import { NextRequest, NextResponse } from 'next/server'
import { withAuth, apiError } from '@/lib/api'
import { validate, einladungenSendenSchema } from '@/lib/validations'
import { createClient } from '@/lib/supabase/server'
import { sendeEinladungsEmail } from '@/lib/email'

export const POST = withAuth(
  async (req: NextRequest, { profile }) => {
    const body = await req.json()
    const v = validate(einladungenSendenSchema, body)
    if (!v.success) return v.error

    const gemeindeId = (profile.role === 'super_admin' && v.data.gemeinde_id)
      ? v.data.gemeinde_id
      : profile.gemeinde_id
    if (!gemeindeId) return apiError('Keine Gemeinde zugewiesen', 400)

    // gemeinden ist öffentlich lesbar → normaler Client reicht, kein Service-Role nötig
    const publicClient = await createClient()
    const { data: gemeinde, error: gemeindeError } = await publicClient
      .from('gemeinden')
      .select('name, slug')
      .eq('id', gemeindeId)
      .single()

    if (gemeindeError) {
      console.error('[einladungen] Gemeinde-Lookup fehlgeschlagen:', { gemeindeId, error: gemeindeError.message })
    }
    if (!gemeinde) return apiError('Gemeinde nicht gefunden', 404)

    const supabase = publicClient

    const ergebnisse: { email: string; ok: boolean; fehler?: string }[] = []

    for (const einladung of v.data.einladungen) {
      // Bestehende offene Einladung für diese E-Mail+Gemeinde widerrufen
      await supabase
        .from('einladungen')
        .update({ status: 'widerrufen' })
        .eq('email', einladung.email.toLowerCase())
        .eq('gemeinde_id', gemeindeId)
        .eq('status', 'offen')

      const { data: neu, error } = await supabase
        .from('einladungen')
        .insert({
          gemeinde_id: gemeindeId,
          email: einladung.email.toLowerCase(),
          rolle: einladung.rolle,
          organisation_name: einladung.organisation_name ?? null,
          hinweis: einladung.hinweis ?? null,
          verein_id: einladung.verein_id ?? null,
          org_id: einladung.org_id ?? null,
          eingeladen_von: profile.id,
        })
        .select('token')
        .single()

      if (error || !neu) {
        ergebnisse.push({ email: einladung.email, ok: false, fehler: error?.message })
        continue
      }

      // Audit-Log
      await supabase.from('rollen_log').insert({
        gemeinde_id: gemeindeId,
        aktion: 'eingeladen',
        ziel_email: einladung.email.toLowerCase(),
        neue_rolle: einladung.rolle,
        einladung_id: null,
        ausgefuehrt_von: profile.id,
      })

      const { error: mailError } = await sendeEinladungsEmail({
        to: einladung.email,
        gemeindeName: gemeinde.name,
        gemeindeSlug: gemeinde.slug,
        rolle: einladung.rolle,
        organisationName: einladung.organisation_name,
        hinweis: einladung.hinweis,
        token: neu.token,
      })

      if (mailError) {
        ergebnisse.push({ email: einladung.email, ok: false, fehler: 'E-Mail konnte nicht gesendet werden' })
      } else {
        ergebnisse.push({ email: einladung.email, ok: true })
      }
    }

    return NextResponse.json({ ergebnisse })
  },
  { roles: ['verwaltung', 'super_admin'] },
)

export const GET = withAuth(
  async (req: NextRequest, { profile }) => {
    const queryGemeindeId = req.nextUrl.searchParams.get('gemeinde_id')
    const gemeindeId = (profile.role === 'super_admin' && queryGemeindeId)
      ? queryGemeindeId
      : profile.gemeinde_id
    if (!gemeindeId) return apiError('Keine Gemeinde zugewiesen', 400)

    const supabase = await createClient()

    // Abgelaufene Einladungen aktualisieren
    await supabase.rpc('einladungen_ablauf_aktualisieren')

    const { data, error } = await supabase
      .from('einladungen')
      .select('*, eingeladen_von_profil:profiles!eingeladen_von(display_name)')
      .eq('gemeinde_id', gemeindeId)
      .order('erstellt_am', { ascending: false })
      .limit(200)

    if (error) return apiError(error.message)

    return NextResponse.json({ einladungen: data ?? [] })
  },
  { roles: ['verwaltung', 'super_admin'] },
)
