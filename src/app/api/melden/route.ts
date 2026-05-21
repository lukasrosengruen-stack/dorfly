import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { inhaltTyp, inhaltId, grund, beschreibung } = await req.json()
  if (!inhaltTyp || !inhaltId || !grund) {
    return NextResponse.json({ error: 'Pflichtfelder fehlen' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('gemeinde_id')
    .eq('id', user.id)
    .single()

  if (!profile?.gemeinde_id) {
    return NextResponse.json({ error: 'Kein Profil gefunden' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('meldungen').insert({
    gemeinde_id: profile.gemeinde_id,
    melder_id: user.id,
    inhalt_typ: inhaltTyp,
    inhalt_id: inhaltId,
    grund,
    beschreibung: beschreibung || null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
