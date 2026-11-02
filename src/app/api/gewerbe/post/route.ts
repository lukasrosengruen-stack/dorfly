import { withAuth } from '@/lib/api'
import { validate, gewerbePostSchema, gewerbePostUpdateSchema, gewerbePostDeleteSchema } from '@/lib/validations'
import { createServiceClient } from '@/lib/supabase/server'
import { meinVereinsziel } from '@/lib/mitgliedschaft'
import { NextResponse } from 'next/server'

function getWochenstart(): Date {
  const now = new Date()
  const day = now.getDay() // 0 = So, 1 = Mo, …
  const diffToMonday = (day === 0 ? -6 : 1 - day)
  const monday = new Date(now)
  monday.setDate(now.getDate() + diffToMonday)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function getNaechstenMontag(): string {
  const monday = getWochenstart()
  monday.setDate(monday.getDate() + 7)
  return monday.toISOString()
}

export const POST = withAuth(
  async (req, { profile }) => {
    const body = await req.json()
    const v = validate(gewerbePostSchema, body)
    if (!v.success) return v.error

    const { gewerbeId, titel, text, bildUrl, ablaufdatum } = v.data

    const service = await createServiceClient()

    // Mitgliedschaft + Plan laden
    const m = await meinVereinsziel(service, profile.id, 'gewerbe')
    const { data: betrieb } = m && m.id === gewerbeId
      ? await service.from('organisationen').select('id, plan, gemeinde_id').eq('id', gewerbeId).eq('typ', 'gewerbe').single()
      : { data: null }

    if (!betrieb) {
      return NextResponse.json({ error: 'Gewerbe nicht gefunden' }, { status: 404 })
    }

    // Wochenlimit gilt für den Betrieb, nicht für die einzelne Person
    if (betrieb.plan === 'standard') {
      const wochenstart = getWochenstart().toISOString()
      const { count } = await service
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', betrieb.id)
        .eq('channel', 'gewerbe')
        .gte('published_at', wochenstart)

      if ((count ?? 0) >= 1) {
        return NextResponse.json(
          { error: 'Wochenlimit erreicht', naechsterMontag: getNaechstenMontag() },
          { status: 429 },
        )
      }
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

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  },
  { roles: ['gewerbe'] },
)
