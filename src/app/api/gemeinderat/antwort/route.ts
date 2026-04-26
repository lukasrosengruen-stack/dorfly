import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const { frageId, antwort } = await request.json()
  if (!frageId || !antwort?.trim()) {
    return NextResponse.json({ error: 'Fehlende Felder' }, { status: 400 })
  }

  const service = await createServiceClient()

  // Verify this Gemeinderat owns this question
  const { data: frage } = await service
    .from('gemeinderat_fragen')
    .select('gemeinderat_id')
    .eq('id', frageId)
    .single()

  if (!frage || frage.gemeinderat_id !== user.id) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const { error } = await service
    .from('gemeinderat_fragen')
    .update({ antwort: antwort.trim(), status: 'beantwortet', beantwortet_at: new Date().toISOString() })
    .eq('id', frageId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
