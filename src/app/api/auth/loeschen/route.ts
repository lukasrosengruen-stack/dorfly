import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api'
import { createServiceClient } from '@/lib/supabase/server'
import { loescheKonto } from '@/lib/kontoLoeschen'

// Ablauf und Fehlerverhalten: siehe src/lib/kontoLoeschen.ts und Migration 064.
// Die user_id kommt ausschließlich aus der Session.
export const DELETE = withAuth(async (_req, { user }) => {
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
  const apiKey = process.env.ONESIGNAL_REST_API_KEY

  const ergebnis = await loescheKonto(user.id, {
    service: await createServiceClient(),
    oneSignal: appId && apiKey ? { appId, apiKey } : null,
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
