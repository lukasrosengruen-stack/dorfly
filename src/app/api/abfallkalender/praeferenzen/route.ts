import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { validate, abfallPraeferenzenSchema } from '@/lib/validations'

// ── GET: Eigene Präferenzen laden ─────────────────────────────────────────────

export const GET = withAuth(async (_req, { profile }) => {
  if (!profile.gemeinde_id) {
    return NextResponse.json({ praeferenzen: null, verfuegbareTypen: [] })
  }

  const supabase = await createClient()

  const [praeferenzenResult, einstellungenResult] = await Promise.all([
    supabase
      .from('abfallkalender_praeferenzen')
      .select('*')
      .eq('user_id', profile.id)
      .eq('gemeinde_id', profile.gemeinde_id)
      .maybeSingle(),
    supabase
      .from('abfallkalender_einstellungen')
      .select('verfuegbare_typen')
      .eq('gemeinde_id', profile.gemeinde_id)
      .maybeSingle(),
  ])

  return NextResponse.json({
    praeferenzen: praeferenzenResult.data ?? null,
    verfuegbareTypen: einstellungenResult.data?.verfuegbare_typen ?? [],
  })
})

// ── POST: Präferenzen speichern ───────────────────────────────────────────────

export const POST = withAuth(async (req, { profile }) => {
  if (!profile.gemeinde_id) {
    return NextResponse.json({ error: 'Keine Gemeinde zugewiesen' }, { status: 400 })
  }

  const body = await req.json()
  const v = validate(abfallPraeferenzenSchema, body)
  if (!v.success) return v.error

  const { ausgewaehlteTypen, pushAktiviert, emailAktiviert, benachrichtigungUhrzeit } = v.data

  // Service client nötig, da abfallkalender_praeferenzen RLS nur auth.uid() = user_id erlaubt,
  // aber withAuth stellt sicher dass wir als richtiger User handeln
  const supabase = await createClient()

  const { error } = await supabase.from('abfallkalender_praeferenzen').upsert(
    {
      user_id: profile.id,
      gemeinde_id: profile.gemeinde_id,
      ausgewaehlte_typen: ausgewaehlteTypen,
      push_aktiviert: pushAktiviert,
      email_aktiviert: emailAktiviert,
      benachrichtigung_uhrzeit: benachrichtigungUhrzeit,
      aktualisiert_am: new Date().toISOString(),
    },
    { onConflict: 'user_id,gemeinde_id' },
  )

  if (error) {
    return NextResponse.json({ error: 'Fehler beim Speichern' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
})
