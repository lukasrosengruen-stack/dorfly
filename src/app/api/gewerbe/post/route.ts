import { withAuth, apiError } from '@/lib/api'
import { validate, gewerbePostSchema, gewerbePostUpdateSchema, gewerbePostDeleteSchema } from '@/lib/validations'
import { createServiceClient } from '@/lib/supabase/server'
import { meinVereinsziel } from '@/lib/mitgliedschaft'
import { NextResponse } from 'next/server'

export const POST = withAuth(
  async (req, { profile }) => {
    const body = await req.json()
    const v = validate(gewerbePostSchema, body)
    if (!v.success) return v.error

    const { gewerbeId, titel, text, bildUrl, ablaufdatum } = v.data

    const service = await createServiceClient()

    // Mitgliedschaft prüfen
    const m = await meinVereinsziel(service, profile.id, 'gewerbe')
    const { data: betrieb } = m && m.id === gewerbeId
      ? await service.from('organisationen').select('id, gemeinde_id').eq('id', gewerbeId).eq('typ', 'gewerbe').single()
      : { data: null }

    if (!betrieb) {
      return NextResponse.json({ error: 'Gewerbe nicht gefunden' }, { status: 404 })
    }

    const { data: post, error } = await service
      .from('posts')
      .insert({
        gemeinde_id: betrieb.gemeinde_id,
        author_id: profile.id,
        org_id: gewerbeId,
        channel: 'gewerbe',
        status: 'published',
        titel: titel?.trim() || text.slice(0, 100),
        inhalt: text,
        bild_url: bildUrl ?? null,
        tag: 'nachricht',
        ...(ablaufdatum ? { publish_at: ablaufdatum } : {}),
      })
      .select()
      .single()

    if (error) {
      console.error('[gewerbe/post] DB-Fehler:', error)
      return apiError('Die Aktion ist fehlgeschlagen. Bitte versuchen Sie es erneut.', 500)
    }

    return NextResponse.json({ post })
  },
  { roles: ['gewerbe'] },
)

export const PATCH = withAuth(
  async (req, { profile }) => {
    const body = await req.json()
    const v = validate(gewerbePostUpdateSchema, body)
    if (!v.success) return v.error

    const { postId, titel, text, bildUrl, ablaufdatum } = v.data

    const service = await createServiceClient()
    const m = await meinVereinsziel(service, profile.id, 'gewerbe')
    if (!m) return NextResponse.json({ error: 'Beitrag nicht gefunden' }, { status: 404 })

    const { data: existing, error: fetchError } = await service
      .from('posts')
      .select('id')
      .eq('id', postId)
      .eq('org_id', m.id)
      .eq('channel', 'gewerbe')
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Beitrag nicht gefunden' }, { status: 404 })
    }

    const { data: post, error } = await service
      .from('posts')
      .update({
        inhalt: text,
        titel: titel?.trim() || text.slice(0, 100),
        ...(bildUrl !== undefined ? { bild_url: bildUrl } : {}),
        ...(ablaufdatum !== undefined ? { publish_at: ablaufdatum } : {}),
      })
      .eq('id', postId)
      .eq('org_id', m.id)
      .select()
      .single()

    if (error) {
      console.error('[gewerbe/post] DB-Fehler:', error)
      return apiError('Die Aktion ist fehlgeschlagen. Bitte versuchen Sie es erneut.', 500)
    }

    return NextResponse.json({ post })
  },
  { roles: ['gewerbe'] },
)

export const DELETE = withAuth(
  async (req, { profile }) => {
    const body = await req.json()
    const v = validate(gewerbePostDeleteSchema, body)
    if (!v.success) return v.error

    const { postId } = v.data

    const service = await createServiceClient()
    const m = await meinVereinsziel(service, profile.id, 'gewerbe')
    if (!m) return NextResponse.json({ error: 'Beitrag nicht gefunden' }, { status: 404 })

    const { error } = await service
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('org_id', m.id)
      .eq('channel', 'gewerbe')

    if (error) {
      console.error('[gewerbe/post] DB-Fehler:', error)
      return apiError('Die Aktion ist fehlgeschlagen. Bitte versuchen Sie es erneut.', 500)
    }

    return NextResponse.json({ ok: true })
  },
  { roles: ['gewerbe'] },
)
