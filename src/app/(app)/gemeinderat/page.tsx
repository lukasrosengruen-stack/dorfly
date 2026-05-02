import { createClient, createServiceClient } from '@/lib/supabase/server'
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

  const service = await createServiceClient()

  const [postsResult, raeteResult, fragenResult] = await Promise.all([
    supabase
      .from('posts')
      .select('id, titel, inhalt, bild_url, bilder_urls, tag, published_at, profiles(display_name, verein_name)')
      .eq('gemeinde_id', gemeindeId)
      .eq('channel', 'gemeinderat')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(50),
    service
      .from('profiles')
      .select('id, display_name, verein_name')
      .eq('gemeinde_id', gemeindeId)
      .eq('role', 'gemeinderat'),
    supabase
      .from('gemeinderat_fragen')
      .select('id, frage, antwort, status, created_at, gemeinderat_id, profiles!gemeinderat_fragen_gemeinderat_id_fkey(display_name)')
      .eq('fragesteller_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  return (
    <GemeinderatClient
      posts={(postsResult.data ?? []) as unknown as Parameters<typeof GemeinderatClient>[0]['posts']}
      raete={raeteResult.data ?? []}
      meineFragen={(fragenResult.data ?? []) as unknown as Parameters<typeof GemeinderatClient>[0]['meineFragen']}
      profileId={user.id}
      gemeindeId={gemeindeId}
      gemeindeName={(profile?.gemeinden as unknown as { name: string } | null)?.name ?? 'Ehningen'}
    />
  )
}
