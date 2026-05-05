import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getGemeinde } from '@/lib/gemeinde'
import AbfallEinstellungenClient from './AbfallEinstellungenClient'

export default async function AbfallEinstellungenPage() {
  const gemeinde = await getGemeinde()

  const featureAktiv = (gemeinde?.features as { wasteCalendarEnabled?: boolean } | null)?.wasteCalendarEnabled ?? false
  if (!featureAktiv) redirect('/home')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('gemeinde_id')
    .eq('id', user.id)
    .single()

  const gemeindeId = profile?.gemeinde_id

  const [praeferenzenResult, einstellungenResult] = await Promise.all([
    gemeindeId
      ? supabase
          .from('abfallkalender_praeferenzen')
          .select('*')
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

  const praeferenzen = praeferenzenResult.data
  const verfuegbareTypen = einstellungenResult.data?.verfuegbare_typen ?? []

  return (
    <AbfallEinstellungenClient
      gemeindeName={gemeinde?.name ?? ''}
      verfuegbareTypen={verfuegbareTypen}
      initialAusgewaehlt={praeferenzen?.ausgewaehlte_typen ?? verfuegbareTypen}
      initialPush={praeferenzen?.push_aktiviert ?? false}
      initialEmail={praeferenzen?.email_aktiviert ?? false}
    />
  )
}
