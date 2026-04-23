import { createClient } from '@/lib/supabase/server'
import BuergermeisterClient from './BuergermeisterClient'

export default async function BuergermeisterPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id ?? '')
    .single()

  const { data: fragen } = profile?.gemeinde_id
    ? await supabase
        .from('fragen')
        .select('*, profiles(display_name, avatar_url)')
        .eq('gemeinde_id', profile.gemeinde_id)
        .order('created_at', { ascending: false })
        .limit(50)
    : { data: [] }

  return <BuergermeisterClient fragen={fragen ?? []} profile={profile} />
}
