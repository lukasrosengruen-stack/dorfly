import type { createClient } from '@/lib/supabase/server'
import type { OrganisationMitBranche, Post } from '@/types/database'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export interface GewerbeDetail {
  betrieb: OrganisationMitBranche
  posts: Post[]
  istAbonniert: boolean
  abonnentenAnzahl: number
}

export async function getGewerbeDetail(
  supabase: SupabaseServerClient,
  gewerbeId: string,
  userId: string | null,
): Promise<GewerbeDetail | null> {
  const [betriebResult, postsResult, abonnementResult, aboCountResult] = await Promise.all([
    supabase
      .from('organisationen')
      .select('*, gewerbe_branchen(id, name)')
      .eq('id', gewerbeId)
      .eq('typ', 'gewerbe')
      .single(),
    supabase
      .from('posts')
      .select('*')
      .eq('org_id', gewerbeId)
      .eq('channel', 'gewerbe')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(20),
    userId
      ? supabase
          .from('gewerbe_abonnements')
          .select('id')
          .eq('user_id', userId)
          .eq('gewerbe_id', gewerbeId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('gewerbe_abonnements')
      .select('id', { count: 'exact', head: true })
      .eq('gewerbe_id', gewerbeId),
  ])

  if (!betriebResult.data) return null

  return {
    betrieb: betriebResult.data as OrganisationMitBranche,
    posts: postsResult.data ?? [],
    istAbonniert: !!abonnementResult.data,
    abonnentenAnzahl: aboCountResult.count ?? 0,
  }
}
