import { createClient, createServiceClient } from '@/lib/supabase/server'
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

  const [postsResult, vereineResult, umfragenResult, abonnementsResult] = await Promise.all([
    gemeindeId
      ? supabase.from('posts')
          .select('id, titel, inhalt, bild_url, bilder_urls, tag, channel, pinned, status, published_at, publish_at, author_id, org_id, veranstaltung_datum, veranstaltung_ort')
          .eq('gemeinde_id', gemeindeId)
          .eq('status', 'published')
          .neq('channel', 'gemeinderat')
          .or(`publish_at.is.null,publish_at.lte.${new Date().toISOString()}`)
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
          .gte('enddatum', new Date().toISOString())
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),

    user
      ? supabase.from('gewerbe_abonnements').select('gewerbe_id').eq('user_id', user.id)
      : Promise.resolve({ data: [] }),
  ])

  const posts = postsResult.data ?? []

  // Autoren-Profile via Service-Client laden (umgeht RLS auf profiles)
  const authorIds = [...new Set(posts.map((p: { author_id: string }) => p.author_id).filter(Boolean))]
  const service = await createServiceClient()
  const { data: authorProfiles } = authorIds.length > 0
    ? await service.from('profiles').select('id, display_name, verein_name, role, avatar_url').in('id', authorIds)
    : { data: [] }

  const postsWithProfiles = posts.map((post: Record<string, unknown> & { author_id: string }) => ({
    ...post,
    profiles: (authorProfiles ?? []).find((p: { id: string }) => p.id === post.author_id) ?? null,
  })) as unknown as Parameters<typeof FeedClient>[0]['posts']

  const vereine = (vereineResult.data ?? [])
    .map((p: { verein_name: string | null }) => p.verein_name)
    .filter((v): v is string => !!v)
    .filter((v, i, arr) => arr.indexOf(v) === i)

  const gewerbeAbonnements = (abonnementsResult.data ?? []).map((a: { gewerbe_id: string }) => a.gewerbe_id)

  const umfragen = umfragenResult.data ?? []

  // N+1-Fix: Alle Teilnahmedaten in 2 Bulk-Queries statt n*2 Einzelqueries
  const umfrageIds = umfragen.map((u) => u.id)

  const [alleTeilnahmenResult, eigenteTeilnahmenResult] = await Promise.all([
    // Alle Teilnahmen für diese Umfragen (für Zählung)
    umfrageIds.length > 0
      ? supabase.from('umfrage_teilnahmen').select('umfrage_id').in('umfrage_id', umfrageIds)
      : Promise.resolve({ data: [] as { umfrage_id: string }[] }),
    // Eigene Teilnahmen des eingeloggten Nutzers
    umfrageIds.length > 0 && user
      ? supabase.from('umfrage_teilnahmen').select('umfrage_id').in('umfrage_id', umfrageIds).eq('user_id', user.id)
      : Promise.resolve({ data: [] as { umfrage_id: string }[] }),
  ])

  const alleTeilnahmen = alleTeilnahmenResult.data ?? []
  const eigeneTeilnahmen = new Set((eigenteTeilnahmenResult.data ?? []).map(t => t.umfrage_id))

  const umfragenMitDaten = umfragen.map((umfrage) => ({
    umfrage,
    hatAbgestimmt: eigeneTeilnahmen.has(umfrage.id),
    teilnehmerAnzahl: alleTeilnahmen.filter(t => t.umfrage_id === umfrage.id).length,
  }))

  return (
    <FeedClient
      posts={postsWithProfiles}
      profile={profile}
      alleVereine={vereine}
      umfragen={umfragenMitDaten}
      gewerbeAbonnements={gewerbeAbonnements}
    />
  )
}
