import { withAuth } from '@/lib/api'
import { validate, vereinPostSchema, vereinPostUpdateSchema, vereinPostDeleteSchema } from '@/lib/validations'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const POST = withAuth(
  async (req, { profile }) => {
    const body = await req.json()
    const v = validate(vereinPostSchema, body)
    if (!v.success) return v.error

    const {
      vereinId, titel, inhalt, tag, bildUrl, bilderUrls, publishAt, veranstaltungDatum, veranstaltungOrt, weitereTermine,
      sammlungArt, sammlungDatum, sammlungOrganisator,
    } = v.data

    const supabase = await createClient()

    const { data: verein, error: fetchError } = await supabase
      .from('vereine')
      .select('id, gemeinde_id')
      .eq('id', vereinId)
      .eq('profile_id', profile.id)
      .single()

    if (fetchError || !verein) {
      return NextResponse.json({ error: 'Verein nicht gefunden' }, { status: 404 })
    }

    const service = await createServiceClient()
    const { data: post, error } = await service
      .from('posts')
      .insert({
        gemeinde_id: verein.gemeinde_id,
        author_id: profile.id,
        org_id: vereinId,
        channel: 'verein',
        status: 'pending',
        titel,
        inhalt,
        tag: tag ?? 'nachricht',
        bild_url: bildUrl ?? null,
        bilder_urls: bilderUrls ?? [],
        publish_at: publishAt ?? null,
        veranstaltung_datum: veranstaltungDatum ?? null,
        veranstaltung_ort: veranstaltungOrt ?? null,
        sammlung_art: tag === 'sammlung' ? sammlungArt : null,
        sammlung_datum: tag === 'sammlung' ? sammlungDatum : null,
        sammlung_organisator: tag === 'sammlung' ? sammlungOrganisator : null,
      })
      .select('id, titel, inhalt, status, created_at, tag, bild_url, publish_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (tag === 'veranstaltung' && weitereTermine && weitereTermine.length > 0) {
      await service.from('post_termine').insert(
        weitereTermine.map(datum => ({ post_id: post.id, datum })),
      )
    }

    return NextResponse.json({ post })
  },
  { roles: ['verein', 'organisation'] },
)

export const PATCH = withAuth(
  async (req, { profile }) => {
    const body = await req.json()
    const v = validate(vereinPostUpdateSchema, body)
    if (!v.success) return v.error

    const { postId, titel, inhalt, tag, bildUrl, bilderUrls, publishAt, veranstaltungDatum, veranstaltungOrt, weitereTermine } = v.data

    const supabase = await createClient()
    const service = await createServiceClient()

    const { data: existing, error: fetchError } = await supabase
      .from('posts')
      .select('id, tag')
      .eq('id', postId)
      .eq('author_id', profile.id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Beitrag nicht gefunden' }, { status: 404 })
    }

    if (tag === 'sammlung' && existing.tag !== 'sammlung') {
      return NextResponse.json({ error: 'Kategorie "Sammlung" kann nachträglich nicht gesetzt werden' }, { status: 400 })
    }

    const { error } = await service
      .from('posts')
      .update({
        titel,
        inhalt,
        tag: tag ?? 'nachricht',
        status: 'pending',
        bild_url: bildUrl ?? null,
        ...(bilderUrls !== undefined ? { bilder_urls: bilderUrls } : {}),
        publish_at: publishAt ?? null,
        veranstaltung_datum: veranstaltungDatum ?? null,
        veranstaltung_ort: veranstaltungOrt ?? null,
      })
      .eq('id', postId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await service.from('post_termine').delete().eq('post_id', postId)
    if (tag === 'veranstaltung' && weitereTermine && weitereTermine.length > 0) {
      await service.from('post_termine').insert(
        weitereTermine.map(datum => ({ post_id: postId, datum })),
      )
    }

    return NextResponse.json({ ok: true })
  },
  { roles: ['verein', 'organisation'] },
)

export const DELETE = withAuth(
  async (req, { profile }) => {
    const body = await req.json()
    const v = validate(vereinPostDeleteSchema, body)
    if (!v.success) return v.error

    const service = await createServiceClient()

    const { error } = await service
      .from('posts')
      .delete()
      .eq('id', v.data.postId)
      .eq('author_id', profile.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  },
  { roles: ['verein', 'organisation'] },
)
