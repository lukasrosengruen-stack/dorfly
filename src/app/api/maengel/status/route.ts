import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { MaengelStatus } from '@/types/database'

export async function POST(req: NextRequest) {
  try {
    const { mangelId, status, nachricht } = await req.json() as {
      mangelId: string
      status: MaengelStatus
      nachricht?: string
    }

    const supabase = await createServiceClient()

    const { error } = await supabase
      .from('maengel')
      .update({
        status,
        nachricht_an_buerger: nachricht || null,
        status_updated_at: new Date().toISOString(),
      })
      .eq('id', mangelId)

    if (error) return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}
