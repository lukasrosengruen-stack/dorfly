import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api'
import { validate, maengelStatusSchema } from '@/lib/validations'

// SICHERHEITSFIX: Route hatte vorher KEINE Authentifizierung!
export const POST = withAuth(
  async (req, { profile }) => {
    const body = await req.json()
    const v = validate(maengelStatusSchema, body)
    if (!v.success) return v.error

    const { mangelId, status, nachricht } = v.data
    const service = await createServiceClient()

    const { error } = await service
      .from('maengel')
      .update({
        status,
        nachricht_an_buerger: nachricht ?? null,
        status_updated_at: new Date().toISOString(),
      })
      .eq('id', mangelId)
      .eq('gemeinde_id', profile.gemeinde_id!)

    if (error) return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })
    return NextResponse.json({ success: true })
  },
  { roles: ['verwaltung', 'super_admin'] },
)
