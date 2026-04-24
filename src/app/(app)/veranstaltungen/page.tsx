import { createClient } from '@/lib/supabase/server'
import KalenderClient from './KalenderClient'

export default async function VeranstaltungenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('gemeinde_id, gemeinden(name)')
    .eq('id', user?.id ?? '')
    .single()

  const gemeindeName = (profile?.gemeinden as unknown as { name: string } | null)?.name ?? 'Ehningen'

  // Fetch from start of current month to end of next month
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59).toISOString()

  const { data: veranstaltungen } = profile?.gemeinde_id
    ? await supabase
        .from('posts')
        .select('id, titel, inhalt, bild_url, veranstaltung_datum, channel, tag, profiles(display_name, verein_name)')
        .eq('gemeinde_id', profile.gemeinde_id)
        .eq('status', 'published')
        .eq('tag', 'veranstaltung')
        .not('veranstaltung_datum', 'is', null)
        .gte('veranstaltung_datum', startOfMonth)
        .lte('veranstaltung_datum', endOfNextMonth)
        .order('veranstaltung_datum', { ascending: true })
    : { data: [] }

  return <KalenderClient veranstaltungen={veranstaltungen ?? []} gemeindeName={gemeindeName} />
}
