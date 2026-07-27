import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api'
import { validate, postCreateSchema } from '@/lib/validations'

export const POST = withAuth(
  async (req, { profile }) => {
    if (!profile.gemeinde_id) return NextResponse.json({ error: 'Keine Gemeinde zugewiesen' }, { status: 400 })

    const body = await req.json()
    const v = validate(postCreateSchema, body)
    if (!v.success) return v.error

    const d = v.data
    const publishedAt = d.publishAt ?? new Date().toISOString()

    const service = await createServiceClient()
    const { data: post, error } = await service
      .from('posts')
      .insert({
        gemeinde_id: profile.gemeinde_id,
        author_id: profile.id,
        channel: 'gemeinde',
        status: 'published',
        titel: d.titel,
        inhalt: d.inhalt,
        tag: d.tag,
        pinned: d.pinned ?? false,
        bild_url: d.bildUrl,
        bilder_urls: d.bilderUrls,
        publish_at: d.publishAt,
        published_at: publishedAt,
        veranstaltung_datum: d.veranstaltungDatum,
        veranstaltung_ort: d.veranstaltungOrt,
        sammlung_art: d.tag === 'sammlung' ? d.sammlungArt : null,
        sammlung_datum: d.tag === 'sammlung' ? d.sammlungDatum : null,
        sammlung_organisator: d.tag === 'sammlung' ? d.sammlungOrganisator : null,
      })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (d.weitereTermine && d.weitereTermine.length > 0) {
      await service.from('post_termine').insert(
        d.weitereTermine.map(datum => ({ post_id: post.id, datum })),
      )
    }

    return NextResponse.json({ post })
  },
  { roles: ['verwaltung', 'super_admin'] },
)
