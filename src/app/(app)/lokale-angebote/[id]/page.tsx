import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import GewerbeProfil from './GewerbeProfil'

export default async function GewerbeProfilPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: betrieb } = await supabase
    .from('organisationen')
    .select('*, gewerbe_branchen(id, name)')
    .eq('id', id)
    .eq('typ', 'gewerbe')
    .single()

  if (!betrieb) notFound()

  const { data: profile } = await supabase
    .from('profiles')
    .select('gemeinde_id')
    .eq('id', user.id)
    .single()

  // Posts laden
  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .eq('org_id', id)
    .eq('channel', 'gewerbe')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(20)

  // Abonnement-Status
  const { data: abo } = await supabase
    .from('gewerbe_abonnements')
    .select('id')
    .eq('user_id', user.id)
    .eq('gewerbe_id', id)
    .maybeSingle()

  // Abonnenten-Anzahl
  const { count: abonnentenAnzahl } = await supabase
    .from('gewerbe_abonnements')
    .select('id', { count: 'exact', head: true })
    .eq('gewerbe_id', id)

  return (
    <GewerbeProfil
      betrieb={betrieb as Parameters<typeof GewerbeProfil>[0]['betrieb']}
      posts={posts ?? []}
      istAbonniert={!!abo}
      abonnentenAnzahl={abonnentenAnzahl ?? 0}
      istEigentümer={profile?.gemeinde_id === betrieb.gemeinde_id && false}
    />
  )
}
