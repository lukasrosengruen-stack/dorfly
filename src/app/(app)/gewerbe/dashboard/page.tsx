import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import GewerbeDashboardClient from './GewerbeDashboardClient'

export default async function GewerbeDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, gemeinden(name)')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'gewerbe') redirect('/feed')

  // Betrieb laden (falls vorhanden)
  const { data: betrieb } = await supabase
    .from('organisationen')
    .select('*')
    .eq('profile_id', user.id)
    .eq('typ', 'gewerbe')
    .single()

  const { data: branchen } = await supabase
    .from('gewerbe_branchen')
    .select('id, name, reihenfolge')
    .order('reihenfolge')

  if (!betrieb) {
    return <GewerbeDashboardClient profile={profile} betrieb={null} branchen={branchen ?? []} abonnentenStats={null} posts={[]} naechsterMontag={null} />
  }

  // Abonnenten-Statistik
  const jetzt = new Date()
  const vor7Tagen = new Date(jetzt.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const vor30Tagen = new Date(jetzt.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: gesamt },
    { count: letzter7Tage },
    { count: letzter30Tage },
  ] = await Promise.all([
    supabase.from('gewerbe_abonnements').select('id', { count: 'exact', head: true }).eq('gewerbe_id', betrieb.id),
    supabase.from('gewerbe_abonnements').select('id', { count: 'exact', head: true }).eq('gewerbe_id', betrieb.id).gte('created_at', vor7Tagen),
    supabase.from('gewerbe_abonnements').select('id', { count: 'exact', head: true }).eq('gewerbe_id', betrieb.id).gte('created_at', vor30Tagen),
  ])

  // Wochenlimit prüfen
  const day = jetzt.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(jetzt)
  monday.setDate(jetzt.getDate() + diffToMonday)
  monday.setHours(0, 0, 0, 0)
  const { count: postsThisWeek } = await supabase
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', user.id)
    .eq('channel', 'gewerbe')
    .gte('published_at', monday.toISOString())

  let naechsterMontag: string | null = null
  if ((postsThisWeek ?? 0) >= 1 && betrieb.plan === 'standard') {
    const nextMonday = new Date(monday)
    nextMonday.setDate(monday.getDate() + 7)
    naechsterMontag = nextMonday.toISOString()
  }

  // Letzte Posts
  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .eq('author_id', user.id)
    .eq('channel', 'gewerbe')
    .order('published_at', { ascending: false })
    .limit(10)

  return (
    <GewerbeDashboardClient
      profile={profile}
      betrieb={betrieb}
      branchen={branchen ?? []}
      abonnentenStats={{ gesamt: gesamt ?? 0, letzter7Tage: letzter7Tage ?? 0, letzter30Tage: letzter30Tage ?? 0 }}
      posts={posts ?? []}
      naechsterMontag={naechsterMontag}
    />
  )
}
