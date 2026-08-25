import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { withAuth, apiError } from '@/lib/api'
import { validate, dashboardSucheSchema } from '@/lib/validations'
import { escapeIlike } from '@/lib/dashboardSuche'

const LIMIT = 20

/**
 * Suche ueber aeltere Eintraege im Verwaltungs-Dashboard.
 *
 * gemeinde_id und Rolle kommen aus withAuth, also serverseitig aus der
 * Session — niemals aus dem Request. Ein Vereins- oder Gewerbe-Account
 * erreicht diese Route dank der roles-Option gar nicht erst.
 */
export const GET = withAuth(
  async (req, { profile }) => {
    const { searchParams } = new URL(req.url)
    const v = validate(dashboardSucheSchema, {
      typ: searchParams.get('typ'),
      q: searchParams.get('q'),
    })
    if (!v.success) return v.error

    const { typ, q } = v.data
    const gemeindeId = profile.gemeinde_id
    if (!gemeindeId) {
      return apiError('Kein Gemeindebezug', 400)
    }

    const service = await createServiceClient()
    // Ein Treffer mehr als noetig, um "es gibt noch mehr" zu erkennen.
    const muster = `%${escapeIlike(q)}%`
    const grenze = LIMIT + 1

    let zeilen: unknown[] = []
    // Wird von jedem Zweig gesetzt und danach einmal gemeinsam geprueft —
    // so bleibt die Fehlerbehandlung nicht viermal dupliziert.
    let fehler: string | null = null

    if (typ === 'maengel') {
      const { data, error } = await service
        .from('maengel')
        .select('id, titel, status, created_at, profiles(display_name)')
        .eq('gemeinde_id', gemeindeId)
        .ilike('titel', muster)
        .order('created_at', { ascending: false })
        .limit(grenze)
      zeilen = data ?? []
      fehler = error?.message ?? null
    } else if (typ === 'fragen') {
      const { data, error } = await service
        .from('fragen')
        .select('id, frage, antwort, status, created_at, profiles(display_name)')
        .eq('gemeinde_id', gemeindeId)
        .ilike('frage', muster)
        .order('created_at', { ascending: false })
        .limit(grenze)
      zeilen = data ?? []
      fehler = error?.message ?? null
    } else if (typ === 'warnmeldungen') {
      const { data, error } = await service
        .from('posts')
        .select('id, titel, severity, is_active, dwd_id, created_at')
        .eq('gemeinde_id', gemeindeId)
        .eq('channel', 'warnung')
        .ilike('titel', muster)
        .order('created_at', { ascending: false })
        .limit(grenze)
      zeilen = data ?? []
      fehler = error?.message ?? null
    } else if (typ === 'beitraege') {
      const { data, error } = await service
        .from('posts')
        .select('id, titel, channel, tag, published_at, publish_at')
        .eq('gemeinde_id', gemeindeId)
        .eq('status', 'published')
        .neq('channel', 'warnung')
        .ilike('titel', muster)
        .order('published_at', { ascending: false })
        .limit(grenze)
      zeilen = data ?? []
      fehler = error?.message ?? null
    } else {
      // Kann durch das Zod-Enum in dashboardSucheSchema aktuell nicht eintreten.
      // Explizit statt als stiller Default, damit ein kuenftig erweitertes
      // SUCH_TYPEN sofort auffaellt statt falsche Ergebnisse zu liefern.
      return apiError('Unbekannter Suchtyp', 400)
    }

    if (fehler) {
      console.error('[verwaltung/suche] Datenbankfehler:', { typ, gemeindeId, fehler })
      return apiError('Suche fehlgeschlagen')
    }

    return NextResponse.json({
      treffer: zeilen.slice(0, LIMIT),
      mehrVorhanden: zeilen.length > LIMIT,
    })
  },
  { roles: ['verwaltung', 'super_admin'] },
)