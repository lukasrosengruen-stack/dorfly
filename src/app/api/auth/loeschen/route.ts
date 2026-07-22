import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api'
import { createServiceClient } from '@/lib/supabase/server'
import { extractStoragePath } from '@/lib/storagePath'

const MEDIA_BUCKET = 'dorfly-media'

// BUGFIX: Falsche Spaltennamen wurden korrigiert (erstellt_von → author_id, author_id → fragesteller_id)
export const DELETE = withAuth(async (_req, { user }) => {
  const service = await createServiceClient()

  // Hochgeladene Mängel-Fotos liegen nur im Storage, nicht in der DB-Zeile referenziert
  // von woanders — vor dem Löschen der Zeilen die Pfade sichern und die Objekte entfernen.
  const { data: eigeneMaengel } = await service
    .from('maengel')
    .select('foto_url')
    .eq('melder_id', user.id)
    .not('foto_url', 'is', null)

  const fotoPaths = (eigeneMaengel ?? [])
    .map(m => m.foto_url && extractStoragePath(m.foto_url, MEDIA_BUCKET))
    .filter((path): path is string => path !== null)

  if (fotoPaths.length > 0) {
    await service.storage.from(MEDIA_BUCKET).remove(fotoPaths)
  }

  // Reihenfolge wichtig wegen FK-Constraints
  await service.from('umfrage_antworten').delete().eq('user_id', user.id)
  await service.from('umfrage_teilnahmen').delete().eq('user_id', user.id)
  await service.from('umfragen').delete().eq('author_id', user.id)          // BUGFIX: war 'erstellt_von'
  await service.from('posts').delete().eq('author_id', user.id)
  await service.from('maengel').delete().eq('melder_id', user.id)
  await service.from('fragen').delete().eq('fragesteller_id', user.id)      // BUGFIX: war 'author_id'
  await service.from('gemeinderat_fragen').delete().eq('fragesteller_id', user.id)
  await service.from('gemeinderat_fragen').delete().eq('gemeinderat_id', user.id)
  await service.from('gewerbe_abonnements').delete().eq('user_id', user.id)
  await service.from('organisationen').delete().eq('profile_id', user.id)
  await service.from('profiles').delete().eq('id', user.id)

  const { error } = await service.auth.admin.deleteUser(user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
})
