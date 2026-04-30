import { withAuth } from '@/lib/api'
import { validate, gewerbeProfilSchema } from '@/lib/validations'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const PATCH = withAuth(
  async (req, { profile }) => {
    const body = await req.json()
    const v = validate(gewerbeProfilSchema, body)
    if (!v.success) return v.error

    const { gewerbeId, name, branche_id, beschreibung, adresse, oeffnungszeiten, website, logo_url } = v.data

    const supabase = await createClient()

    // Sicherstellen dass der Nutzer Eigentümer dieses Gewerbes ist
    const { data: betrieb, error: fetchError } = await supabase
      .from('organisationen')
      .select('id')
      .eq('id', gewerbeId)
      .eq('profile_id', profile.id)
      .eq('typ', 'gewerbe')
      .single()

    if (fetchError || !betrieb) {
      return NextResponse.json({ error: 'Gewerbe nicht gefunden' }, { status: 404 })
    }

    const { data: updated, error } = await supabase
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
      .eq('id', gewerbeId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ betrieb: updated })
  },
  { roles: ['gewerbe'] },
)
