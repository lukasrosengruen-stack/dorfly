import { withAuth } from '@/lib/api'
import { validate, vereinAbonnierenSchema } from '@/lib/validations'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const POST = withAuth(async (req, { profile }) => {
  const body = await req.json()
  const v = validate(vereinAbonnierenSchema, body)
  if (!v.success) return v.error

  const supabase = await createClient()

  const { error } = await supabase
    .from('verein_abonnements')
    .insert({ user_id: profile.id, verein_id: v.data.vereinId })

  if (error) {
    if (error.code === '23505') return NextResponse.json({ ok: true, already: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
})

export const DELETE = withAuth(async (req, { profile }) => {
  const body = await req.json()
  const v = validate(vereinAbonnierenSchema, body)
  if (!v.success) return v.error

  const supabase = await createClient()

  const { error } = await supabase
    .from('verein_abonnements')
    .delete()
    .eq('user_id', profile.id)
    .eq('verein_id', v.data.vereinId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
})
