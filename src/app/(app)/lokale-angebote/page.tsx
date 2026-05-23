import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getGemeinde } from '@/lib/gemeinde'
import { isFeatureAktiv } from '@/lib/features'
import LokaleAngeboteClient from './LokaleAngeboteClient'

export const metadata: Metadata = { title: 'Lokale Angebote – Dorfly' }

export default async function LokaleAngebotePage() {
  const gemeinde = await getGemeinde()
  if (!isFeatureAktiv(gemeinde, 'gewerbe')) redirect('/home')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, gemeinden(name)')
    .eq('id', user.id)
    .single()

  const gemeindeId = profile?.gemeinde_id
  if (!gemeindeId) return <LokaleAngeboteClient betriebe={[]} branchen={[]} profile={profile} abonnements={[]} />

  const [{ data: betriebe }, { data: abonnements }, { data: branchen }] = await Promise.all([
    supabase
      .from('organisationen')
      .select('*, gewerbe_branchen(id, name)')
      .eq('gemeinde_id', gemeindeId)
      .eq('typ', 'gewerbe')
      .order('name'),
    supabase
      .from('gewerbe_abonnements')
      .select('gewerbe_id')
      .eq('user_id', user.id),
    supabase
      .from('gewerbe_branchen')
      .select('id, name, reihenfolge')
      .order('reihenfolge'),
  ])

  const vorhandendeBranchenIds = new Set((betriebe ?? []).map(b => b.branche_id).filter(Boolean))
  const gefilterteBranchen = (branchen ?? []).filter(b => vorhandendeBranchenIds.has(b.id))

  return (
    <LokaleAngeboteClient
      betriebe={(betriebe ?? []) as Parameters<typeof LokaleAngeboteClient>[0]['betriebe']}
      branchen={gefilterteBranchen}
      profile={profile}
      abonnements={(abonnements ?? []).map(a => a.gewerbe_id)}
    />
  )
}
