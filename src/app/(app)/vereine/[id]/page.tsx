import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import VereinProfil from './VereinProfil'

export default async function VereinDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [vereinResult, postsResult, abonnementResult, aboCountResult] = await Promise.all([
    supabase
      .from('vereine')
      .select('*, verein_kategorien(id, name)')
      .eq('id', id)
      .single(),
    supabase
      .from('posts')
      .select('id, titel, inhalt, bild_url, published_at, tag')
      .eq('org_id', id)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(20),
    supabase
      .from('verein_abonnements')
      .select('id')
      .eq('user_id', user.id)
      .eq('verein_id', id)
      .maybeSingle(),
    supabase
      .from('verein_abonnements')
      .select('id', { count: 'exact', head: true })
      .eq('verein_id', id),
  ])

  if (!vereinResult.data) notFound()

  return (
    <VereinProfil
      verein={vereinResult.data as Parameters<typeof VereinProfil>[0]['verein']}
      posts={(postsResult.data ?? []) as Parameters<typeof VereinProfil>[0]['posts']}
      istAbonniert={!!abonnementResult.data}
      abonnentenAnzahl={aboCountResult.count ?? 0}
    />
  )
}
