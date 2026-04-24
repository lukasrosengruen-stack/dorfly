import { createClient } from '@/lib/supabase/server'
import FeedClient from './FeedClient'

export default async function FeedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, gemeinden(name)')
    .eq('id', user?.id ?? '')
    .single()

  const gemeindeId = profile?.gemeinde_id

  const [postsResult, vereineResult, umfragenResult] = await Promise.all([
    gemeindeId
      ? supabase.from('posts')
          .select('*, profiles(display_name, avatar_url, role, verein_name)')
          .eq('gemeinde_id', gemeindeId)
          .eq('status', 'published')
          .order('pinned', { ascending: false })
          .order('published_at', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),

    gemeindeId
      ? supabase.from('profiles')
          .select('verein_name')
          .eq('gemeinde_id', gemeindeId)
          .eq('role', 'verein')
          .not('verein_name', 'is', null)
      : Promise.resolve({ data: [] }),

    gemeindeId
      ? supabase.from('umfragen')
          .select('*, umfrage_fragen(*, umfrage_optionen(*))')
          .eq('gemeinde_id', gemeindeId)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  const vereine = (vereineResult.data ?? [])
    .map((p: { verein_name: string | null }) => p.verein_name)
    .filter((v): v is string => !!v)
    .filter((v, i, arr) => arr.indexOf(v) === i)

  const umfragen = umfragenResult.data ?? []

  const umfragenMitDaten = await Promise.all(
    umfragen.map(async (umfrage) => {
      const [teilnahmeResult, countResult] = await Promise.all([
        user
          ? supabase.from('umfrage_teilnahmen').select('user_id').eq('umfrage_id', umfrage.id).eq('user_id', user.id).single()
          : Promise.resolve({ data: null }),
        supabase.from('umfrage_teilnahmen').select('*', { count: 'exact', head: true }).eq('umfrage_id', umfrage.id),
      ])
      return {
        umfrage,
        hatAbgestimmt: !!teilnahmeResult.data,
        teilnehmerAnzahl: countResult.count ?? 0,
      }
    })
  )

  return (
    <FeedClient
      posts={postsResult.data ?? []}
      profile={profile}
      alleVereine={vereine}
      umfragen={umfragenMitDaten}
    />
  )
}
