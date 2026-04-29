import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api'
import { validate, umfrageLoeschenSchema } from '@/lib/validations'

export const POST = withAuth(
  async (req) => {
    const body = await req.json()
    const v = validate(umfrageLoeschenSchema, body)
    if (!v.success) return v.error

    const service = await createServiceClient()
    const { error } = await service.from('umfragen').delete().eq('id', v.data.umfrageId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  },
  { roles: ['verwaltung', 'super_admin'] },
)
