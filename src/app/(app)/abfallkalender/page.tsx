import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getGemeinde } from '@/lib/gemeinde'
import { isFeatureAktiv } from '@/lib/features'
import AbfallkalenderClient from './AbfallkalenderClient'

export const metadata: Metadata = { title: 'Abfallkalender – Dorfly' }

export default async function AbfallkalenderPage() {
  const gemeinde = await getGemeinde()

  if (!isFeatureAktiv(gemeinde, 'abfallkalender')) redirect('/home')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('gemeinde_id')
    .eq('id', user.id)
    .single()

  const gemeindeId = profile?.gemeinde_id

  // Termine und Nutzer-Präferenzen parallel laden
  const now = new Date()
  // 90 Tage Zeitraum (maximales Filter-Fenster)
  const start = now.toISOString().slice(0, 10)
  const end = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [termineResult, praeferenzenResult, einstellungenResult] = await Promise.all([
    gemeindeId
      ? supabase
          .from('abfalltermine')
          .select('id, typ, datum')
          .eq('gemeinde_id', gemeindeId)
          .gte('datum', start)
          .lte('datum', end)
          .order('datum', { ascending: true })
      : Promise.resolve({ data: [] }),
    gemeindeId
      ? supabase
          .from('abfallkalender_praeferenzen')
          .select('ausgewaehlte_typen, push_aktiviert, email_aktiviert, benachrichtigung_uhrzeit')
          .eq('user_id', user.id)
          .eq('gemeinde_id', gemeindeId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    gemeindeId
      ? supabase
          .from('abfallkalender_einstellungen')
          .select('verfuegbare_typen')
          .eq('gemeinde_id', gemeindeId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const termine = (termineResult.data ?? []) as { id: string; typ: string; datum: string }[]
  const praeferenzen = praeferenzenResult.data
  const verfuegbareTypen = einstellungenResult.data?.verfuegbare_typen ?? []

  // Wenn keine Präferenzen: alle verfügbaren Typen vorauswählen
  const ausgewaehlteTypen: string[] = praeferenzen?.ausgewaehlte_typen ?? verfuegbareTypen

  return (
    <AbfallkalenderClient
      termine={termine}
      ausgewaehlteTypen={ausgewaehlteTypen}
      verfuegbareTypen={verfuegbareTypen}
      gemeindeName={gemeinde?.name ?? ''}
      hatPraeferenzen={praeferenzen !== null}
    />
  )
}
