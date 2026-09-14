import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withAuth, apiError } from '@/lib/api'
import { validate, umfrageErgebnisseSchema } from '@/lib/validations'
import { berechneErgebnisse, type ErgebnisZeile } from '@/lib/umfrageErgebnisse'

/**
 * Ergebnisse einer einzelnen Umfrage — wird erst beim Aufklappen abgerufen.
 *
 * Bewusst der RLS-gebundene Nutzer-Client, nicht der Service-Client: Die RPC
 * umfrage_ergebnisse prueft intern ueber current_gemeinde_id() und
 * is_verwaltung(), beides leitet sich aus der Session ab. Mit dem
 * Service-Client waeren diese Pruefungen wirkungslos.
 */
export const GET = withAuth(
  async (req, { profile }) => {
    const { searchParams } = new URL(req.url)
    const v = validate(umfrageErgebnisseSchema, { umfrageId: searchParams.get('umfrageId') })
    if (!v.success) return v.error

    const { umfrageId } = v.data
    const gemeindeId = profile.gemeinde_id
    if (!gemeindeId) return apiError('Kein Gemeindebezug', 400)

    const supabase = await createClient()

    // Zusaetzliche Absicherung: Die Umfrage muss zur eigenen Gemeinde gehoeren.
    // Die RPC prueft das ebenfalls, aber die Route verlaesst sich nicht darauf.
    const { data: umfrage, error: umfrageFehler } = await supabase
      .from('umfragen')
      .select('id, umfrage_fragen(id, frage_text, typ, umfrage_optionen(id, option_text, reihenfolge))')
      .eq('id', umfrageId)
      .eq('gemeinde_id', gemeindeId)
      .maybeSingle()

    if (umfrageFehler) {
      console.error('[umfrage-ergebnisse] Abfrage fehlgeschlagen:', umfrageFehler.message)
      return apiError('Ergebnisse konnten nicht geladen werden')
    }
    if (!umfrage) return apiError('Umfrage nicht gefunden', 404)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: antworten, error: rpcFehler } = await (supabase.rpc as any)(
      'umfrage_ergebnisse',
      { p_umfrage_id: umfrageId },
    )

    if (rpcFehler) {
      console.error('[umfrage-ergebnisse] RPC fehlgeschlagen:', rpcFehler.message)
      return apiError('Ergebnisse konnten nicht geladen werden')
    }

    const fragen = (umfrage.umfrage_fragen ?? []) as {
      id: string; frage_text: string; typ: string
      umfrage_optionen?: { id: string; option_text: string; reihenfolge: number }[]
    }[]

    return NextResponse.json({
      ergebnisse: berechneErgebnisse(fragen, (antworten ?? []) as ErgebnisZeile[]),
    })
  },
  { roles: ['verwaltung', 'super_admin'] },
)
