import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['verwaltung', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    const { postId, action } = await request.json()
    if (!postId || !['publish', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Ungültige Parameter' }, { status: 400 })
    }

    const service = await createServiceClient()
    const { error } = await service.from('posts').update({
      status: action === 'publish' ? 'published' : 'rejected',
      published_at: action === 'publish' ? new Date().toISOString() : undefined,
    }).eq('id', postId)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fehler' }, { status: 500 })
  }
}
