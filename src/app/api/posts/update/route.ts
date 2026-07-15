import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api'
import { validate, postUpdateSchema } from '@/lib/validations'

export const PATCH = withAuth(
  async (req, { profile }) => {
    const body = await req.json()
    const v = validate(postUpdateSchema, body)
    if (!v.success) return v.error

    const { id, weitereTermine, ...fields } = v.data
    const tag = v.data.tag
    const isGemeinderat = profile.role === 'gemeinderat'
    const updateFields = isGemeinderat ? { ...fields, status: 'pending' as const } : fields

    const service = await createServiceClient()

    // Verhindert, dass ein Beitrag, der bisher NICHT 'sammlung' war, über diese generische
    // Route auf 'sammlung' gesetzt wird — diese Route rührt sammlung_art/sammlung_datum/
    // sammlung_organisator nicht an, ein solcher Wechsel würde den CHECK-Constraint aus
    // 051_posts_sammlung_felder.sql verletzen. Ein bereits vorhandener Sammlung-Beitrag darf
    // (mit tag weiterhin 'sammlung') normal editiert werden.
    if (tag === 'sammlung') {
      const { data: existing, error: fetchError } = await (isGemeinderat
        ? service.from('posts').select('tag').eq('id', id).eq('gemeinde_id', profile.gemeinde_id!).eq('author_id', profile.id)
        : service.from('posts').select('tag').eq('id', id).eq('gemeinde_id', profile.gemeinde_id!)
      ).single()

      if (fetchError || !existing) {
        return NextResponse.json({ error: 'Beitrag nicht gefunden' }, { status: 404 })
      }
      if (existing.tag !== 'sammlung') {
        return NextResponse.json({ error: 'Kategorie "Sammlung" kann nachträglich nicht gesetzt werden' }, { status: 400 })
      }
    }

    const { error } = await (isGemeinderat
      ? service.from('posts').update(updateFields).eq('id', id).eq('gemeinde_id', profile.gemeinde_id!).eq('author_id', profile.id)
      : service.from('posts').update(updateFields).eq('id', id).eq('gemeinde_id', profile.gemeinde_id!))

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (weitereTermine !== undefined) {
      await service.from('post_termine').delete().eq('post_id', id)
      if (tag === 'veranstaltung' && weitereTermine.length > 0) {
        await service.from('post_termine').insert(
          weitereTermine.map(datum => ({ post_id: id, datum })),
        )
      }
    }

    return NextResponse.json({ ok: true })
  },
  { roles: ['verwaltung', 'super_admin', 'gemeinderat'] },
)
