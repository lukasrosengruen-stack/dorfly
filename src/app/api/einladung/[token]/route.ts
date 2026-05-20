import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/einladung/[token] – Öffentlicher Endpunkt, liefert Einladungsdetails für die Registrierungsseite
export async function GET(req: NextRequest) {
  const token = req.nextUrl.pathname.split('/').at(-1)
  if (!token || token.length < 10) {
    return NextResponse.json({ error: 'Ungültiger Token' }, { status: 400 })
  }

  // Anon-kompatibler Lookup via SECURITY DEFINER-Funktion (kein service_role nötig)
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('get_einladung_by_token', { p_token: token })

  if (error) {
    console.error('[einladung/token] RPC-Fehler:', error.message)
    return NextResponse.json({ error: 'Einladung nicht gefunden' }, { status: 404 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Einladung nicht gefunden' }, { status: 404 })
  }

  const einladung = data as {
    email: string
    rolle: string
    organisation_name: string | null
    hinweis: string | null
    status: string
    ablauft_am: string
    gemeinde_id: string
    gemeinde_name: string
  }

  if (einladung.status !== 'offen') {
    const grund =
      einladung.status === 'angenommen' ? 'bereits_angenommen' :
      einladung.status === 'abgelaufen'  ? 'abgelaufen'         : 'widerrufen'
    return NextResponse.json({ error: 'Einladung nicht mehr gültig', grund }, { status: 410 })
  }

  return NextResponse.json({
    email:             einladung.email,
    rolle:             einladung.rolle,
    organisation_name: einladung.organisation_name,
    hinweis:           einladung.hinweis,
    gemeinde_name:     einladung.gemeinde_name,
    ablauft_am:        einladung.ablauft_am,
  })
}
