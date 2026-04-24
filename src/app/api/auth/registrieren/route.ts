import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { userId, vorname, nachname, adresse, geburtsdatum } = await request.json()
    if (!userId) return NextResponse.json({ error: 'Keine User-ID' }, { status: 400 })

    const supabase = await createServiceClient()

    const { data: gemeinde } = await supabase
      .from('gemeinden')
      .select('id')
      .eq('slug', 'ehningen')
      .single()

    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      phone: null,
      phone_verified: false,
      role: 'buerger',
      gemeinde_id: gemeinde?.id ?? null,
      vorname: vorname || null,
      nachname: nachname || null,
      display_name: [vorname, nachname].filter(Boolean).join(' ') || null,
      adresse: adresse || null,
      geburtsdatum: geburtsdatum || null,
    })

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fehler' }, { status: 500 })
  }
}
