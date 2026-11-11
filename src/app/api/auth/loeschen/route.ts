import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api'
import { createServiceClient } from '@/lib/supabase/server'
import { loescheKonto } from '@/lib/kontoLoeschen'
import { pushKonfig } from '@/lib/pushKonfig'

// Ablauf und Fehlerverhalten: siehe src/lib/kontoLoeschen.ts und Migration 064.
// Die user_id kommt ausschließlich aus der Session.
export const DELETE = withAuth(async (_req, { user }) => {
  const push = pushKonfig()

  const ergebnis = await loescheKonto(user.id, {
    service: await createServiceClient(),
    oneSignal: push.status === 'an' ? push : push.status === 'testumgebung' ? 'testumgebung' : null,
  })

  if (!ergebnis.ok) {
    console.error('[konto-loeschen] abgebrochen', { userId: user.id, schritt: ergebnis.schritt, fehler: ergebnis.fehler })
    return NextResponse.json(
      { error: 'Das Konto konnte nicht gelöscht werden. Bitte versuchen Sie es erneut.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
})
