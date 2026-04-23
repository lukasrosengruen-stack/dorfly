import { createClient } from '@/lib/supabase/server'
import UmfragenClient from './UmfragenClient'

export default async function UmfragenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id ?? '')
    .single()

  const gemeindeId = profile?.gemeinde_id

  const { data: umfragen } = gemeindeId
    ? await supabase
        .from('umfragen')
        .select('*, umfrage_fragen(*, umfrage_optionen(*))')
        .eq('gemeinde_id', gemeindeId)
        .order('created_at', { ascending: false })
    : { data: [] }

  const umfragenMitDaten = await Promise.all(
    (umfragen ?? []).map(async (umfrage) => {
      const teilnahmeResult = user
        ? await supabase.from('umfrage_teilnahmen').select('user_id').eq('umfrage_id', umfrage.id).eq('user_id', user.id).single()
        : { data: null }

      const { count } = await supabase
        .from('umfrage_teilnahmen')
        .select('*', { count: 'exact', head: true })
        .eq('umfrage_id', umfrage.id)

      return { umfrage, hatAbgestimmt: !!teilnahmeResult.data, teilnehmerAnzahl: count ?? 0 }
    })
  )

  return (
    <UmfragenClient
      umfragen={umfragenMitDaten}
      profile={profile}
    />
  )
}
