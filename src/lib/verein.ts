import type { createClient } from '@/lib/supabase/server'
import type { VereinMitKategorie } from '@/types/database'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export interface VereinPost {
  id: string
  titel: string
  inhalt: string
  bild_url: string | null
  published_at: string
  tag: string | null
}

export interface VereinDetail {
  verein: VereinMitKategorie
  posts: VereinPost[]
  istAbonniert: boolean
  abonnentenAnzahl: number
}

export async function getVereinDetail(
  supabase: SupabaseServerClient,
  vereinId: string,
  userId: string,
): Promise<VereinDetail | null> {
  const [vereinResult, postsResult, abonnementResult, aboCountResult] = await Promise.all([
    supabase
      .from('vereine')
      .select('*, verein_kategorien(id, name)')
      .eq('id', vereinId)
      .single(),
    supabase
      .from('posts')
      .select('id, titel, inhalt, bild_url, published_at, tag')
      .eq('org_id', vereinId)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(20),
    supabase
      .from('verein_abonnements')
      .select('id')
      .eq('user_id', userId)
      .eq('verein_id', vereinId)
      .maybeSingle(),
    supabase
      .from('verein_abonnements')
      .select('id', { count: 'exact', head: true })
      .eq('verein_id', vereinId),
  ])

  if (!vereinResult.data) return null

  return {
    verein: vereinResult.data as VereinMitKategorie,
    posts: (postsResult.data ?? []) as VereinPost[],
    istAbonniert: !!abonnementResult.data,
    abonnentenAnzahl: aboCountResult.count ?? 0,
  }
}
