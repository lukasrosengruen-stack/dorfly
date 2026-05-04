import { withAuth } from '@/lib/api'
import { validate, gewerbePostSchema, gewerbePostUpdateSchema, gewerbePostDeleteSchema } from '@/lib/validations'
import { createClient } from '@/lib/supabase/server'
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

    const { gewerbeId, text, bildUrl, ablaufdatum } = v.data

    const supabase = await createClient()

    // Eigentümerprüfung + Plan laden
    const { data: betrieb, error: fetchError } = await supabase
      .from('organisationen')
      .select('id, plan, gemeinde_id')
      .eq('id', gewerbeId)
      .eq('profile_id', profile.id)
      .eq('typ', 'gewerbe')
      .single()

    if (fetchError || !betrieb) {
      return NextResponse.json({ error: 'Gewerbe nicht gefunden' }, { status: 404 })
    }

    // Wochenlimit für Standard-Plan prüfen
    if (betrieb.plan === 'standard') {
      const wochenstart = getWochenstart().toISOString()
      const { count } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('author_id', profile.id)
        .eq('channel', 'gewerbe')
        .gte('published_at', wochenstart)

      if ((count ?? 0) >= 1) {
        return NextResponse.json(
          { error: 'Wochenlimit erreicht', naechsterMontag: getNaechstenMontag() },
          { status: 429 },
        )
      }
    }

    const { data: post, error } = await supabase
      .from('posts')
      .insert({
        gemeinde_id: betrieb.gemeinde_id,
        author_id: profile.id,
        org_id: gewerbeId,
        channel: 'gewerbe',
        status: 'published',
        titel: text.slice(0, 100),
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

    const { postId, text, bildUrl, ablaufdatum } = v.data

    const supabase = await createClient()

    const { data: existing, error: fetchError } = await supabase
      .from('posts')
      .select('id')
      .eq('id', postId)
      .eq('author_id', profile.id)
      .eq('channel', 'gewerbe')
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Beitrag nicht gefunden' }, { status: 404 })
    }

    const { data: post, error } = await supabase
      .from('posts')
      .update({
        inhalt: text,
        titel: text.slice(0, 100),
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

    const supabase = await createClient()

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('author_id', profile.id)
      .eq('channel', 'gewerbe')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  },
  { roles: ['gewerbe'] },
)
