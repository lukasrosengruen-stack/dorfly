import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, gemeinde_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'verwaltung') {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await req.json()
  const { post_id } = body as { post_id?: string }
  if (!post_id) return NextResponse.json({ error: 'post_id erforderlich' }, { status: 400 })

  const service = await createServiceClient()

  const { data: post } = await service
    .from('posts')
    .select('id, gemeinde_id, dwd_id, channel')
    .eq('id', post_id)
    .single()

  if (!post) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  if ((post as any).channel !== 'warnung') {
    return NextResponse.json({ error: 'Kein Warnmeldungs-Post' }, { status: 400 })
  }
  if ((post as any).dwd_id !== null) {
    return NextResponse.json({ error: 'DWD-Warnungen können nicht manuell deaktiviert werden' }, { status: 400 })
  }
  if (post.gemeinde_id !== profile.gemeinde_id) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  await service.from('posts').update({ is_active: false } as any).eq('id', post_id)

  return NextResponse.json({ ok: true })
}
