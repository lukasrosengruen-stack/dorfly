import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api'
import { z } from 'zod'

const schema = z.object({
  titel: z.string().min(1).max(200),
  inhalt: z.string().min(1).max(10000),
  tag: z.string(),
  bildUrl: z.string().nullable(),
  bilderUrls: z.array(z.string()),
  publishAt: z.string().nullable(),
  publishedAt: z.string(),
  veranstaltungDatum: z.string().nullable(),
  veranstaltungOrt: z.string().nullable(),
})

export const POST = withAuth(
  async (req, { user, profile }) => {
    if (!profile.gemeinde_id) return NextResponse.json({ error: 'Keine Gemeinde zugewiesen' }, { status: 400 })

    const body = await req.json()
    const v = schema.safeParse(body)
    if (!v.success) return NextResponse.json({ error: 'Ungültige Daten' }, { status: 400 })

    const d = v.data
    const service = await createServiceClient()
    const { error } = await service.from('posts').insert({
      gemeinde_id: profile.gemeinde_id,
      author_id: user.id,
      channel: 'gemeinderat',
      titel: d.titel,
      inhalt: d.inhalt,
      tag: d.tag,
      status: 'pending',
      pinned: false,
      bild_url: d.bildUrl,
      bilder_urls: d.bilderUrls,
      publish_at: d.publishAt,
      published_at: d.publishedAt,
      veranstaltung_datum: d.veranstaltungDatum,
      veranstaltung_ort: d.veranstaltungOrt,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  },
  { roles: ['gemeinderat'] },
)
