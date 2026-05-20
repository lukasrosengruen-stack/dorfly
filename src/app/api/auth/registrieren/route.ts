import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validate, registrierenSchema } from '@/lib/validations'
import { profilAnlegen } from '@/lib/profil-anlegen'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }

    const body = await request.json()
    const v = validate(registrierenSchema, body)
    if (!v.success) return v.error

    const { vorname, nachname, token } = v.data
    await profilAnlegen(user.id, { email: user.email ?? undefined, vorname, nachname, token })

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : JSON.stringify(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
