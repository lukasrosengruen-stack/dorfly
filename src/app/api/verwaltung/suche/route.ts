import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api'
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
      return NextResponse.json({ error: 'Kein Gemeindebezug' }, { status: 400 })
    }

    const service = await createServiceClient()
    // Ein Treffer mehr als noetig, um "es gibt noch mehr" zu erkennen.
    const muster = `%${escapeIlike(q)}%`
    const grenze = LIMIT + 1

    let zeilen: unknown[] = []

    if (typ === 'maengel') {
      const { data } = await service
        .from('maengel')
        .select('id, titel, status, created_at, profiles(display_name)')
        .eq('gemeinde_id', gemeindeId)
        .ilike('titel', muster)
        .order('created_at', { ascending: false })
        .limit(grenze)
      zeilen = data ?? []
    } else if (typ === 'fragen') {
      const { data } = await service
        .from('fragen')
        .select('id, frage, antwort, status, created_at, profiles(display_name)')
        .eq('gemeinde_id', gemeindeId)
        .ilike('frage', muster)
        .order('created_at', { ascending: false })
        .limit(grenze)
      zeilen = data ?? []
    } else if (typ === 'warnmeldungen') {
      const { data } = await service
        .from('posts')
        .select('id, titel, severity, is_active, dwd_id, created_at')
        .eq('gemeinde_id', gemeindeId)
        .eq('channel', 'warnung')
        .ilike('titel', muster)
        .order('created_at', { ascending: false })
        .limit(grenze)
      zeilen = data ?? []
    } else {
      const { data } = await service
        .from('posts')
        .select('id, titel, channel, tag, published_at, publish_at')
        .eq('gemeinde_id', gemeindeId)
        .eq('status', 'published')
        .neq('channel', 'warnung')
        .ilike('titel', muster)
        .order('published_at', { ascending: false })
        .limit(grenze)
      zeilen = data ?? []
    }

    return NextResponse.json({
      treffer: zeilen.slice(0, LIMIT),
      mehrVorhanden: zeilen.length > LIMIT,
    })
  },
  { roles: ['verwaltung', 'super_admin'] },
)