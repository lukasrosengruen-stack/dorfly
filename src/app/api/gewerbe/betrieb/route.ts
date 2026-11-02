import { withAuth, apiError } from '@/lib/api'
import { validate } from '@/lib/validations'
import { createServiceClient } from '@/lib/supabase/server'
import { meineMitgliedschaft, rpcFehler } from '@/lib/mitgliedschaft'
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

    const service = await createServiceClient()

    if (await meineMitgliedschaft(service, profile.id)) {
      return NextResponse.json({ error: 'Betrieb bereits vorhanden' }, { status: 409 })
    }

    const { data: betriebId, error: anlegeFehler } = await service.rpc('verein_anlegen', {
      p_profile_id: profile.id,
      p_typ: 'gewerbe',
      p_name: v.data.name,
      p_ausgefuehrt_von: profile.id,
    })
    if (anlegeFehler || !betriebId) {
      const f = rpcFehler(anlegeFehler ?? { message: 'kein Ergebnis' })
      return apiError(f.meldung, f.status)
    }

    const { data: betrieb, error } = await service
      .from('organisationen')
      .update({
        branche_id: v.data.branche_id ?? null,
        beschreibung: v.data.beschreibung ?? null,
        adresse: v.data.adresse ?? null,
        oeffnungszeiten: v.data.oeffnungszeiten ?? null,
        website: v.data.website || null,
        logo_url: v.data.logo_url ?? null,
      })
      .eq('id', betriebId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ betrieb })
  },
  { roles: ['gewerbe'] },
)
