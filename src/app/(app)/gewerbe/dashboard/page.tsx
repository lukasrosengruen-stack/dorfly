import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { meinVereinsziel, kurzname } from '@/lib/mitgliedschaft'
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
  const service = await createServiceClient()
  const mitgliedschaft = await meinVereinsziel(service, user.id, 'gewerbe')

  const { data: betrieb } = mitgliedschaft
    ? await service.from('organisationen').select('*').eq('id', mitgliedschaft.id).eq('typ', 'gewerbe').single()
    : { data: null }
  const mitgliedRolle = mitgliedschaft?.rolle ?? null

  const { data: branchen } = await supabase
    .from('gewerbe_branchen')
    .select('id, name, reihenfolge')
    .order('reihenfolge')

  if (!betrieb) {
    return <GewerbeDashboardClient profile={profile} betrieb={null} branchen={branchen ?? []} abonnentenStats={null} posts={[]} naechsterMontag={null} mitgliedRolle={null} autorNamen={{}} />
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
    service.from('gewerbe_abonnements').select('id', { count: 'exact', head: true }).eq('gewerbe_id', betrieb.id),
    service.from('gewerbe_abonnements').select('id', { count: 'exact', head: true }).eq('gewerbe_id', betrieb.id).gte('created_at', vor7Tagen),
    service.from('gewerbe_abonnements').select('id', { count: 'exact', head: true }).eq('gewerbe_id', betrieb.id).gte('created_at', vor30Tagen),
  ])

  // Wochenlimit prüfen
  const day = jetzt.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(jetzt)
  monday.setDate(jetzt.getDate() + diffToMonday)
  monday.setHours(0, 0, 0, 0)
  const { count: postsThisWeek } = await service
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', betrieb.id)
    .eq('channel', 'gewerbe')
    .gte('published_at', monday.toISOString())

  let naechsterMontag: string | null = null
  if ((postsThisWeek ?? 0) >= 1 && betrieb.plan === 'standard') {
    const nextMonday = new Date(monday)
    nextMonday.setDate(monday.getDate() + 7)
    naechsterMontag = nextMonday.toISOString()
  }

  // Letzte Posts
  const { data: posts } = await service
    .from('posts')
    .select('*')
    .eq('org_id', betrieb.id)
    .eq('channel', 'gewerbe')
    .order('published_at', { ascending: false })
    .limit(10)

  const autorIds = [...new Set((posts ?? []).map(p => p.author_id).filter((id): id is string => !!id))]
  const { data: autoren } = autorIds.length
    ? await service.from('profiles').select('id, vorname, nachname, display_name').in('id', autorIds)
    : { data: [] }
  const autorNamen = Object.fromEntries((autoren ?? []).map(a => [a.id, kurzname(a) ?? '']))
  // Eigener Name auch ohne bisherige Beiträge — neu angelegte erscheinen sofort mit „von …“
  autorNamen[user.id] = kurzname(profile) ?? ''

  return (
    <GewerbeDashboardClient
      profile={profile}
      betrieb={betrieb}
      branchen={branchen ?? []}
      abonnentenStats={{ gesamt: gesamt ?? 0, letzter7Tage: letzter7Tage ?? 0, letzter30Tage: letzter30Tage ?? 0 }}
      posts={posts ?? []}
      naechsterMontag={naechsterMontag}
      mitgliedRolle={mitgliedRolle}
      autorNamen={autorNamen}
    />
  )
}
