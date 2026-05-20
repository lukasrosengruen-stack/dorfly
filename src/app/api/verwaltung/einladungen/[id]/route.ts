import { NextRequest, NextResponse } from 'next/server'
import { withAuth, apiError } from '@/lib/api'
import { createClient } from '@/lib/supabase/server'
import { sendeEinladungsEmail } from '@/lib/email'

// DELETE /api/verwaltung/einladungen/[id] – Einladung widerrufen
export const DELETE = withAuth(
  async (req: NextRequest, { profile }) => {
    const id = req.nextUrl.pathname.split('/').at(-1)
    if (!id) return apiError('ID fehlt', 400)

    const supabase = await createClient()

    const gemeindeFilter = profile.role === 'super_admin'
      ? supabase.from('einladungen').select('id, status, email, rolle, gemeinde_id').eq('id', id).single()
      : supabase.from('einladungen').select('id, status, email, rolle, gemeinde_id').eq('id', id).eq('gemeinde_id', profile.gemeinde_id!).single()

    const { data: einladung } = await gemeindeFilter

    if (!einladung) return apiError('Einladung nicht gefunden', 404)
    if (einladung.status !== 'offen') return apiError('Nur offene Einladungen können widerrufen werden', 400)

    const { error } = await supabase
      .from('einladungen')
      .update({ status: 'widerrufen' })
      .eq('id', id)

    if (error) return apiError(error.message)

    await supabase.from('rollen_log').insert({
      gemeinde_id: einladung.gemeinde_id,
      aktion: 'widerrufen',
      ziel_email: einladung.email,
      alte_rolle: einladung.rolle,
      einladung_id: id,
      ausgefuehrt_von: profile.id,
    })

    return NextResponse.json({ ok: true })
  },
  { roles: ['verwaltung', 'super_admin'] },
)

// POST /api/verwaltung/einladungen/[id] – Einladung erneut senden
export const POST = withAuth(
  async (req: NextRequest, { profile }) => {
    const id = req.nextUrl.pathname.split('/').at(-1)
    if (!id) return apiError('ID fehlt', 400)

    const supabase = await createClient()

    const einladungQuery = profile.role === 'super_admin'
      ? supabase.from('einladungen').select('*').eq('id', id).single()
      : supabase.from('einladungen').select('*').eq('id', id).eq('gemeinde_id', profile.gemeinde_id!).single()

    const { data: einladung } = await einladungQuery

    if (!einladung) return apiError('Einladung nicht gefunden', 404)
    if (einladung.status === 'angenommen') return apiError('Einladung bereits angenommen', 400)
    if (einladung.status === 'widerrufen') return apiError('Einladung wurde widerrufen', 400)

    const neuesAblaufdatum = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    await supabase
      .from('einladungen')
      .update({ status: 'offen', ablauft_am: neuesAblaufdatum })
      .eq('id', id)

    const { data: gemeinde } = await supabase
      .from('gemeinden')
      .select('name')
      .eq('id', einladung.gemeinde_id)
      .single()

    const { error: mailError } = await sendeEinladungsEmail({
      to: einladung.email,
      gemeindeName: gemeinde?.name ?? '',
      rolle: einladung.rolle,
      organisationName: einladung.organisation_name,
      hinweis: einladung.hinweis,
      token: einladung.token,
    })

    if (mailError) return apiError('E-Mail konnte nicht gesendet werden')

    return NextResponse.json({ ok: true })
  },
  { roles: ['verwaltung', 'super_admin'] },
)
