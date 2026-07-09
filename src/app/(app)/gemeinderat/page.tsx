import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getGemeinde } from '@/lib/gemeinde'
import { isFeatureAktiv } from '@/lib/features'
import GemeinderatClient from './GemeinderatClient'

export const metadata: Metadata = { title: 'Gemeinderat – Dorfly' }

export default async function GemeinderatPage() {
  const gemeinde = await getGemeinde()
  if (!isFeatureAktiv(gemeinde, 'gemeinderat')) redirect('/home')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, gemeinde_id, display_name, gemeinden(name)')
    .eq('id', user.id)
    .single()

  const gemeindeId = profile?.gemeinde_id
  if (!gemeindeId) redirect('/home')

  const [postsResult, raeteResult, fragenResult] = await Promise.all([
    supabase
      .from('posts')
      .select('id, titel, inhalt, bild_url, bilder_urls, tag, published_at, profiles:profiles_public!posts_author_id_fkey(display_name, verein_name)')
      .eq('gemeinde_id', gemeindeId)
      .eq('channel', 'gemeinderat')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(50),
    supabase
      .from('profiles_public')
      .select('id, display_name, verein_name, fraktion, ueber_mich, kontakt_email, social_x, social_facebook, social_instagram, social_tiktok')
      .eq('gemeinde_id', gemeindeId)
      .eq('role', 'gemeinderat'),
    supabase
      .from('gemeinderat_fragen')
      .select('id, frage, antwort, status, created_at, gemeinderat_id, profiles:profiles_public!gemeinderat_fragen_gemeinderat_id_fkey(display_name)')
      .eq('fragesteller_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  return (
    <GemeinderatClient
      posts={(postsResult.data ?? []) as unknown as Parameters<typeof GemeinderatClient>[0]['posts']}
      raete={raeteResult.data ?? []}
      meineFragen={(fragenResult.data ?? []) as unknown as Parameters<typeof GemeinderatClient>[0]['meineFragen']}
      profileId={user.id}
      profileDisplayName={profile?.display_name ?? null}
      gemeindeId={gemeindeId}
      gemeindeName={(profile?.gemeinden as unknown as { name: string } | null)?.name ?? 'Ehningen'}
    />
  )
}
