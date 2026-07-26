import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGewerbeDetail } from '@/lib/gewerbe'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  // Gaeste duerfen Gewerbedetails sehen (App-Store 5.1.1(v)).
  // Abonnement-Status/-Zaehlung werden fuer Gaeste in getGewerbeDetail uebersprungen.
  const { data: { user } } = await supabase.auth.getUser()

  const detail = await getGewerbeDetail(supabase, id, user?.id ?? null)
  if (!detail) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  return NextResponse.json(detail)
}
