import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GemeinderatClient from './GemeinderatClient'

export default async function GemeinderatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, gemeinde_id, gemeinden(name)')
    .eq('id', user.id)
    .single()

  const gemeindeId = profile?.gemeinde_id
  if (!gemeindeId) redirect('/home')

  const [postsResult, raeteResult] = await Promise.all([
    supabase
      .from('posts')
      .select('id, titel, inhalt, bild_url, bilder_urls, tag, published_at, profiles(display_name, verein_name)')
      .eq('gemeinde_id', gemeindeId)
      .eq('channel', 'gemeinderat')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(50),
    supabase
      .from('profiles')
      .select('id, display_name, verein_name')
      .eq('gemeinde_id', gemeindeId)
      .eq('role', 'gemeinderat'),
  ])

  return (
    <GemeinderatClient
      posts={postsResult.data ?? []}
      raete={raeteResult.data ?? []}
      profileId={user.id}
      gemeindeId={gemeindeId}
      gemeindeName={(profile?.gemeinden as { name: string } | null)?.name ?? 'Ehningen'}
    />
  )
}
