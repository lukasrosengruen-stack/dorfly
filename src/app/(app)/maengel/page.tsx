import { createClient } from '@/lib/supabase/server'
import MaengelClient from './MaengelClient'

export default async function MaengelPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id ?? '')
    .single()

  const { data: maengel } = profile?.gemeinde_id
    ? await supabase
        .from('maengel')
        .select('*, profiles(display_name)')
        .eq('gemeinde_id', profile.gemeinde_id)
        .eq('melder_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(100)
    : { data: [] }

  return <MaengelClient maengel={maengel ?? []} profile={profile} />
}
