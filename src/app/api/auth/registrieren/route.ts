import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { validate, registrierenSchema } from '@/lib/validations'
import { getGemeindeSlug } from '@/lib/gemeinde'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const v = validate(registrierenSchema, body)
    if (!v.success) return v.error

    const { userId, vorname, nachname } = v.data
    const supabase = await createServiceClient()

    const slug = await getGemeindeSlug()
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
