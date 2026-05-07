import { withAuth } from '@/lib/api'
import { validate, vereinProfilErstellenSchema, vereinProfilAktualisierenSchema } from '@/lib/validations'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const POST = withAuth(
  async (req, { profile }) => {
    if (!profile.gemeinde_id) {
      return NextResponse.json({ error: 'Keine Gemeinde zugeordnet' }, { status: 400 })
    }

    const body = await req.json()
    const v = validate(vereinProfilErstellenSchema, body)
    if (!v.success) return v.error

    const supabase = await createClient()

    const { data: existing } = await supabase
      .from('vereine')
      .select('id')
      .eq('profile_id', profile.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Profil bereits vorhanden' }, { status: 409 })
    }

    const typ = (profile as { role: string }).role === 'organisation' ? 'organisation' : 'verein'

    const { data: verein, error } = await supabase
      .from('vereine')
      .insert({
        profile_id: profile.id,
        gemeinde_id: profile.gemeinde_id,
        verein_name: v.data.verein_name,
        typ,
        kategorie_id: v.data.kategorie_id ?? null,
        beschreibung: v.data.beschreibung ?? null,
        website: v.data.website || null,
        logo_url: v.data.logo_url ?? null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // verein_name im Profil synchronisieren (für Feed-Anzeige)
    await supabase
      .from('profiles')
      .update({ verein_name: v.data.verein_name })
      .eq('id', profile.id)

    return NextResponse.json({ verein })
  },
  { roles: ['verein', 'organisation'] },
)

export const PATCH = withAuth(
  async (req, { profile }) => {
    const body = await req.json()
    const v = validate(vereinProfilAktualisierenSchema, body)
    if (!v.success) return v.error

    const supabase = await createClient()

    const { data: verein, error } = await supabase
      .from('vereine')
      .update({
        verein_name: v.data.verein_name,
        kategorie_id: v.data.kategorie_id ?? null,
        beschreibung: v.data.beschreibung ?? null,
        website: v.data.website || null,
        logo_url: v.data.logo_url ?? null,
      })
      .eq('id', v.data.vereinId)
      .eq('profile_id', profile.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase
      .from('profiles')
      .update({ verein_name: v.data.verein_name })
      .eq('id', profile.id)

    return NextResponse.json({ verein })
  },
  { roles: ['verein', 'organisation'] },
)
