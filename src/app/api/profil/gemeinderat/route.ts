import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api'
import { z } from 'zod'

const schema = z.object({
  fraktion: z.string().max(100).nullable(),
  ueber_mich: z.string().max(1000).nullable(),
  kontakt_email: z.string().email().max(200).nullable(),
})

export const PATCH = withAuth(
  async (req, { user }) => {
    const body = await req.json()
    const v = schema.safeParse(body)
    if (!v.success) return NextResponse.json({ error: 'Ungültige Daten' }, { status: 400 })

    const supabase = await createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ fraktion: v.data.fraktion, ueber_mich: v.data.ueber_mich, kontakt_email: v.data.kontakt_email })
      .eq('id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  },
  { roles: ['gemeinderat'] },
)
