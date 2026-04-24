import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const service = await createServiceClient()

  // Alle Nutzerdaten löschen (Reihenfolge wichtig wegen FK-Constraints)
  await service.from('umfrage_antworten').delete().eq('user_id', user.id)
  await service.from('umfrage_teilnahmen').delete().eq('user_id', user.id)
  await service.from('umfragen').delete().eq('erstellt_von', user.id)
  await service.from('posts').delete().eq('author_id', user.id)
  await service.from('maengel').delete().eq('melder_id', user.id)
  await service.from('fragen').delete().eq('author_id', user.id)
  await service.from('sms_verifications').delete().eq('user_id', user.id)
  await service.from('profiles').delete().eq('id', user.id)

  const { error } = await service.auth.admin.deleteUser(user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
