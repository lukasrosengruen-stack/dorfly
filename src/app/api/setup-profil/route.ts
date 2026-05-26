import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { profilAnlegen } from '@/lib/profil-anlegen'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const meta = user.user_metadata ?? {}
  await profilAnlegen(user.id, {
    email: user.email ?? undefined,
    vorname: meta.vorname,
    nachname: meta.nachname,
    token: meta.einladungs_token,
  })

  const { data: profile } = await supabase
    .from('profiles')
    .select('gemeinden(slug)')
    .eq('id', user.id)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const slug = (profile as any)?.gemeinden?.slug as string | undefined
  return NextResponse.json({ slug })
}
