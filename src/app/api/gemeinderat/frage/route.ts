import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const { gemeinderatId, frage, gemeindeId } = await request.json()
  if (!gemeinderatId || !frage?.trim() || !gemeindeId) {
    return NextResponse.json({ error: 'Fehlende Felder' }, { status: 400 })
  }

  const service = await createServiceClient()
  const { error } = await service.from('gemeinderat_fragen').insert({
    gemeinde_id: gemeindeId,
    fragesteller_id: user.id,
    gemeinderat_id: gemeinderatId,
    frage: frage.trim(),
    status: 'offen',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
