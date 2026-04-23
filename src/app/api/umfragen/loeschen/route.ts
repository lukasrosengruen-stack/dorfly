import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { umfrageId } = await req.json() as { umfrageId: string }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

    const service = await createServiceClient()

    const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['verwaltung', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    const { error } = await service.from('umfragen').delete().eq('id', umfrageId)
    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Umfrage löschen:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Fehler' }, { status: 500 })
  }
}
