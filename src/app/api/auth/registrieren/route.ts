import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { userId, vorname, nachname } = await request.json()
    if (!userId) return NextResponse.json({ error: 'Keine User-ID' }, { status: 400 })

    const supabase = await createServiceClient()

    const slug = request.headers.get('x-gemeinde-slug') ?? process.env.NEXT_PUBLIC_DEFAULT_GEMEINDE_SLUG ?? 'ehningen'
    const { data: gemeinde } = await supabase
      .from('gemeinden')
      .select('id')
      .eq('slug', slug)
      .single()

    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      role: 'buerger',
      gemeinde_id: gemeinde?.id ?? null,
      vorname: vorname || null,
      nachname: nachname || null,
      display_name: [vorname, nachname].filter(Boolean).join(' ') || null,
    })

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fehler' }, { status: 500 })
  }
}
