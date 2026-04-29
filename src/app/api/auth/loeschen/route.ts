import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api'
import { createServiceClient } from '@/lib/supabase/server'

// BUGFIX: Falsche Spaltennamen wurden korrigiert (erstellt_von → author_id, author_id → fragesteller_id)
export const DELETE = withAuth(async (req, { user, profile }) => {
  const service = await createServiceClient()

  // Reihenfolge wichtig wegen FK-Constraints
  await service.from('umfrage_antworten').delete().eq('user_id', user.id)
  await service.from('umfrage_teilnahmen').delete().eq('user_id', user.id)
  await service.from('umfragen').delete().eq('author_id', user.id)          // BUGFIX: war 'erstellt_von'
  await service.from('posts').delete().eq('author_id', user.id)
  await service.from('maengel').delete().eq('melder_id', user.id)
  await service.from('fragen').delete().eq('fragesteller_id', user.id)      // BUGFIX: war 'author_id'
  await service.from('gemeinderat_fragen').delete().eq('fragesteller_id', user.id)
  await service.from('gemeinderat_fragen').delete().eq('gemeinderat_id', user.id)
  await service.from('sms_verifications').delete().eq('phone', profile.phone) // BUGFIX: kein user_id, lösche per phone
  await service.from('profiles').delete().eq('id', user.id)

  const { error } = await service.auth.admin.deleteUser(user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
})
