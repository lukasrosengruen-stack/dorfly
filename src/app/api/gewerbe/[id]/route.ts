import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGewerbeDetail } from '@/lib/gewerbe'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const detail = await getGewerbeDetail(supabase, id, user.id)
  if (!detail) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  return NextResponse.json(detail)
}
