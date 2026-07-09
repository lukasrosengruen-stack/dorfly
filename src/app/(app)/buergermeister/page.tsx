import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getGemeinde } from '@/lib/gemeinde'
import { getBuergermeisterLabel } from '@/lib/features'
import BuergermeisterClient from './BuergermeisterClient'
import type { FrageMitProfil } from '@/types/database'

export const metadata: Metadata = { title: 'Frag den Bürgermeister – Dorfly' }

export default async function BuergermeisterPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const gemeinde = await getGemeinde()
  const { long: titel } = getBuergermeisterLabel(gemeinde)

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id ?? '')
    .single()

  const { data: fragen } = profile?.gemeinde_id
    ? await supabase
        .from('fragen')
        .select('*')
        .eq('gemeinde_id', profile.gemeinde_id)
        .order('created_at', { ascending: false })
        .limit(50)
    : { data: [] }

  return <BuergermeisterClient fragen={(fragen ?? []) as FrageMitProfil[]} profile={profile} titel={titel} />
}
