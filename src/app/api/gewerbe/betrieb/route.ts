import { withAuth } from '@/lib/api'
import { validate } from '@/lib/validations'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const erstellenSchema = z.object({
  name: z.string().min(1).max(200),
  branche_id: z.string().uuid().nullable().optional(),
  beschreibung: z.string().max(2000).nullable().optional(),
  adresse: z.string().max(500).nullable().optional(),
  oeffnungszeiten: z.string().max(1000).nullable().optional(),
  website: z.union([z.url(), z.literal(''), z.null()]).optional(),
  logo_url: z.union([z.url(), z.null()]).optional(),
})

export const POST = withAuth(
  async (req, { profile }) => {
    if (!profile.gemeinde_id) {
      return NextResponse.json({ error: 'Keine Gemeinde zugeordnet' }, { status: 400 })
    }

    const body = await req.json()
    const v = validate(erstellenSchema, body)
    if (!v.success) return v.error

    const supabase = await createClient()

    // Sicherstellen dass noch kein Betrieb existiert
    const { data: existing } = await supabase
      .from('organisationen')
      .select('id')
      .eq('profile_id', profile.id)
      .eq('typ', 'gewerbe')
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Betrieb bereits vorhanden' }, { status: 409 })
    }

    const { data: betrieb, error } = await supabase
      .from('organisationen')
      .insert({
        gemeinde_id: profile.gemeinde_id,
        profile_id: profile.id,
        typ: 'gewerbe',
        name: v.data.name,
        branche_id: v.data.branche_id ?? null,
        beschreibung: v.data.beschreibung ?? null,
        adresse: v.data.adresse ?? null,
        oeffnungszeiten: v.data.oeffnungszeiten ?? null,
        website: v.data.website || null,
        logo_url: v.data.logo_url ?? null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ betrieb })
  },
  { roles: ['gewerbe'] },
)
