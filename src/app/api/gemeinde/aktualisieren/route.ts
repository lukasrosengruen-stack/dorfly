import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api'
import { validate, gemeindeAktualisierenSchema } from '@/lib/validations'

export const POST = withAuth(
  async (req, { profile }) => {
    const body = await req.json()
    const v = validate(gemeindeAktualisierenSchema, body)
    if (!v.success) return v.error

    // Sicherstellen dass nur die eigene Gemeinde aktualisiert wird
    if (v.data.gemeindeId !== profile.gemeinde_id) {
      return NextResponse.json({ error: 'Keine Berechtigung für diese Gemeinde' }, { status: 403 })
    }

    const service = await createServiceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (service as any)
      .from('gemeinden')
      .update({
        einwohner:            v.data.einwohner,
        haushalte:            v.data.haushalte,
        ratsinformation_url:  v.data.ratsinformation_url  ?? null,
        notfallnummern_url:   v.data.notfallnummern_url   ?? null,
        homepage_url:         v.data.homepage_url         ?? null,
        mitteilungsblatt_url: v.data.mitteilungsblatt_url ?? null,
        warncell_id:          v.data.warncell_id          ?? null,
      })
      .eq('id', v.data.gemeindeId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  },
  { roles: ['verwaltung', 'super_admin'] },
)
