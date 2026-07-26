import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getGemeinde } from '@/lib/gemeinde'
import KalenderClient from './KalenderClient'

export const metadata: Metadata = { title: 'Veranstaltungen – Dorfly' }

export default async function VeranstaltungenPage() {
  const supabase = await createClient()
  const gemeinde = await getGemeinde()
  const gemeindeId = gemeinde?.id
  const gemeindeName = gemeinde?.name ?? 'Ehningen'

  // Fetch from start of current month to end of next month
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59).toISOString()

  type V = Parameters<typeof KalenderClient>[0]['veranstaltungen'][number]

  const [{ data: haupttermine }, { data: zusatztermine }] = gemeindeId
    ? await Promise.all([
        supabase
          .from('posts')
          .select('id, titel, inhalt, bild_url, veranstaltung_datum, veranstaltung_ort, channel, tag, profiles:profiles_public!posts_author_id_fkey(display_name, verein_name)')
          .eq('gemeinde_id', gemeindeId)
          .eq('status', 'published')
          .eq('tag', 'veranstaltung')
          .not('veranstaltung_datum', 'is', null)
          .gte('veranstaltung_datum', startOfMonth)
          .lte('veranstaltung_datum', endOfNextMonth)
          .order('veranstaltung_datum', { ascending: true }),
        supabase
          .from('post_termine')
          .select('datum, posts!inner(id, titel, inhalt, bild_url, veranstaltung_ort, channel, tag, status, gemeinde_id, profiles:profiles_public!posts_author_id_fkey(display_name, verein_name))')
          .eq('posts.gemeinde_id', gemeindeId)
          .eq('posts.status', 'published')
          .eq('posts.tag', 'veranstaltung')
          .gte('datum', startOfMonth)
          .lte('datum', endOfNextMonth)
          .order('datum', { ascending: true }),
      ])
    : [{ data: [] }, { data: [] }]

  const zusatzAlsVeranstaltung = ((zusatztermine ?? []) as unknown as { datum: string; posts: Omit<V, 'id' | 'veranstaltung_datum'> & { id: string } }[])
    .map(({ datum, posts: post }) => ({ ...post, id: `${post.id}::${datum}`, veranstaltung_datum: datum }) as V)

  const veranstaltungen = [...((haupttermine ?? []) as unknown as V[]), ...zusatzAlsVeranstaltung]
    .sort((a, b) => a.veranstaltung_datum.localeCompare(b.veranstaltung_datum))

  return <KalenderClient veranstaltungen={veranstaltungen} gemeindeName={gemeindeName} />
}
