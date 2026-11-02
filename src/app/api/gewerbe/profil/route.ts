import { withAuth, apiError } from '@/lib/api'
import { validate, gewerbeProfilSchema } from '@/lib/validations'
import { createServiceClient } from '@/lib/supabase/server'
import { meinVereinsziel } from '@/lib/mitgliedschaft'
import { NextResponse } from 'next/server'

export const PATCH = withAuth(
  async (req, { profile }) => {
    const v = validate(gewerbeProfilSchema, await req.json())
    if (!v.success) return v.error

    const { gewerbeId, name, branche_id, beschreibung, adresse, oeffnungszeiten, website, logo_url } = v.data

    const service = await createServiceClient()
    const m = await meinVereinsziel(service, profile.id, 'gewerbe')
    if (!m || m.id !== gewerbeId) return apiError('Gewerbe nicht gefunden', 404)
    if (m.rolle !== 'verwalter') return apiError('Nur Verwalter können das Profil bearbeiten.', 403)

    const { data: updated, error } = await service
      .from('organisationen')
      .update({
        name,
        branche_id: branche_id ?? null,
        beschreibung: beschreibung ?? null,
        adresse: adresse ?? null,
        oeffnungszeiten: oeffnungszeiten ?? null,
        website: website || null,
        logo_url: logo_url ?? null,
      })
      .eq('id', m.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ betrieb: updated })
  },
  { roles: ['gewerbe'] },
)
