import { NextRequest, NextResponse } from 'next/server'
import { withAuth, apiError } from '@/lib/api'
import { createClient } from '@/lib/supabase/server'
import type { GemeindeFeatures } from '@/lib/features'

export const PATCH = withAuth(
  async (req: NextRequest) => {
    const id = req.nextUrl.pathname.split('/').at(-2)
    if (!id) return apiError('ID fehlt', 400)

    const body = await req.json() as Partial<GemeindeFeatures>

    const supabase = await createClient()

    const { data: gemeinde, error: fetchError } = await supabase
      .from('gemeinden')
      .select('features')
      .eq('id', id)
      .single()

    if (fetchError || !gemeinde) return apiError('Gemeinde nicht gefunden', 404)

    const current = (gemeinde.features ?? {}) as GemeindeFeatures
    const updated = { ...current, ...body }

    const { data, error } = await supabase
      .from('gemeinden')
      .update({ features: updated })
      .eq('id', id)
      .select('features')
      .single()

    if (error) return apiError(error.message)

    return NextResponse.json({ features: data.features })
  },
  { roles: ['super_admin'] },
)
