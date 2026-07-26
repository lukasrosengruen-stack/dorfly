import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getGemeinde } from '@/lib/gemeinde'
import { isFeatureAktiv } from '@/lib/features'
import VereinListeClient from './VereinListeClient'

export const metadata: Metadata = { title: 'Vereine – Dorfly' }

export default async function VereinePage() {
  const gemeinde = await getGemeinde()
  if (!isFeatureAktiv(gemeinde, 'vereine')) redirect('/home')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = user
    ? (await supabase
        .from('profiles')
        .select('*, gemeinden(name)')
        .eq('id', user.id)
        .single()).data
    : null

  const gemeindeId = profile?.gemeinde_id ?? gemeinde?.id
  if (!gemeindeId) {
    return <VereinListeClient vereine={[]} kategorien={[]} profile={profile} abonnements={[]} />
  }

  const [vereineResult, kategorienResult, abonnementsResult] = await Promise.all([
    supabase
      .from('vereine')
      .select('*, verein_kategorien(id, name)')
      .eq('gemeinde_id', gemeindeId)
      .order('verein_name'),
    supabase
      .from('verein_kategorien')
      .select('id, name, reihenfolge')
      .order('reihenfolge'),
    user
      ? supabase
          .from('verein_abonnements')
          .select('verein_id')
          .eq('user_id', user.id)
      : Promise.resolve({ data: [] }),
  ])

  const vorhandeneKategorieIds = new Set(
    (vereineResult.data ?? []).map(v => v.kategorie_id).filter(Boolean),
  )
  const gefilterteKategorien = (kategorienResult.data ?? []).filter(k =>
    vorhandeneKategorieIds.has(k.id),
  )

  return (
    <VereinListeClient
      vereine={(vereineResult.data ?? []) as Parameters<typeof VereinListeClient>[0]['vereine']}
      kategorien={gefilterteKategorien}
      profile={profile}
      abonnements={(abonnementsResult.data ?? []).map(a => a.verein_id)}
    />
  )
}
