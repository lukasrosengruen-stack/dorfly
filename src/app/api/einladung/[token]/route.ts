import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/einladung/[token] – Öffentlicher Endpunkt, liefert Einladungsdetails für die Registrierungsseite
export async function GET(req: NextRequest) {
  const token = req.nextUrl.pathname.split('/').at(-1)
  if (!token || token.length < 10) {
    return NextResponse.json({ error: 'Ungültiger Token' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  // Abgelaufene Einladungen aktualisieren
  await supabase.rpc('einladungen_ablauf_aktualisieren')

  const { data: einladung } = await supabase
    .from('einladungen')
    .select('email, rolle, organisation_name, hinweis, status, ablauft_am, gemeinde_id')
    .eq('token', token)
    .single()

  if (!einladung) {
    return NextResponse.json({ error: 'Einladung nicht gefunden' }, { status: 404 })
  }

  if (einladung.status !== 'offen') {
    const grund =
      einladung.status === 'angenommen' ? 'bereits_angenommen' :
      einladung.status === 'abgelaufen'  ? 'abgelaufen'         : 'widerrufen'
    return NextResponse.json({ error: 'Einladung nicht mehr gültig', grund }, { status: 410 })
  }

  const { data: gemeinde } = await supabase
    .from('gemeinden')
    .select('name')
    .eq('id', einladung.gemeinde_id)
    .single()

  return NextResponse.json({
    email: einladung.email,
    rolle: einladung.rolle,
    organisation_name: einladung.organisation_name,
    hinweis: einladung.hinweis,
    gemeinde_name: gemeinde?.name ?? '',
    ablauft_am: einladung.ablauft_am,
  })
}
