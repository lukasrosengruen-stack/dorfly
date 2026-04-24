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

  const isAdmin = profile?.role === 'verwaltung' || profile?.role === 'super_admin'

  const query = profile?.gemeinde_id
    ? supabase
        .from('maengel')
        .select('*, profiles(display_name)')
        .eq('gemeinde_id', profile.gemeinde_id)
        .order('created_at', { ascending: false })
        .limit(100)
    : null

  const { data: maengel } = query
    ? isAdmin ? await query : await query.eq('melder_id', user!.id)
    : { data: [] }

  return <MaengelClient maengel={maengel ?? []} profile={profile} />
}
