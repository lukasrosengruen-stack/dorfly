import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminDashboardClient from './AdminDashboardClient'
import type {
  BuergerStats, RolleStats, MaengelStats, PostsStats,
  ProduzentenAccount, HealthComponents, DashboardData,
} from './types'

function computeHealthScore(
  buerger: BuergerStats,
  rollen: RolleStats[],
  maengel: MaengelStats,
  posts: PostsStats,
): { score: number; components: HealthComponents } {
  const mauRate = buerger.total > 0
    ? (buerger.mau / buerger.total) * 100
    : 0

  const retentionRate = buerger.retention_eligible > 0
    ? (buerger.retention_active / buerger.retention_eligible) * 100
    : 100

  const maengelRate = maengel.total > 0
    ? (maengel.erledigt / maengel.total) * 100
    : 100

  const totalProduzenten = rollen.reduce((s, r) => s + r.account_count, 0)
  const activeProduzenten = rollen.reduce((s, r) => s + r.active_30d, 0)
  const prodAktivRate = totalProduzenten > 0
    ? (activeProduzenten / totalProduzenten) * 100
    : 100

  const postsRate = totalProduzenten > 0
    ? Math.min((posts.posts_7d / totalProduzenten) * 100, 100)
    : 100

  const score = Math.round(
    mauRate      * 0.30 +
    retentionRate * 0.20 +
    maengelRate   * 0.20 +
    prodAktivRate * 0.20 +
    postsRate     * 0.10,
  )

  return {
    score: Math.min(score, 100),
    components: {
      mauScore:       Math.round(mauRate),
      retentionScore: Math.round(retentionRate),
      maengelScore:   Math.round(maengelRate),
      prodAktivScore: Math.round(prodAktivRate),
      postsScore:     Math.round(postsRate),
    },
  }
}

const EMPTY_BUERGER: BuergerStats = { total: 0, mau: 0, retention_eligible: 0, retention_active: 0 }
const EMPTY_MAENGEL: MaengelStats = { total: 0, erledigt: 0 }
const EMPTY_POSTS: PostsStats    = { posts_7d: 0, posts_30d: 0 }

export default async function SuperAdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ gemeinde?: string }>
}) {
  const params = await searchParams
  const gemeindeId = params.gemeinde ?? null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') redirect('/')

  const service = await createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = service as any

  const [
    gemeindenResult,
    buergerResult,
    rollenResult,
    maengelResult,
    postsResult,
    verwaltungResult,
    vereinResult,
    organisationResult,
    gewerbeResult,
    gemeinderatResult,
  ] = await Promise.all([
    supabase.from('gemeinden').select('id, name, slug, bundesland, plz, einwohner, features').order('name'),
    svc.rpc('superadmin_buerger_stats',      { p_gemeinde_id: gemeindeId }),
    svc.rpc('superadmin_rollen_stats',        { p_gemeinde_id: gemeindeId }),
    svc.rpc('superadmin_maengel_stats',       { p_gemeinde_id: gemeindeId }),
    svc.rpc('superadmin_posts_stats',         { p_gemeinde_id: gemeindeId }),
    svc.rpc('superadmin_produzentenaccounts', { p_rolle: 'verwaltung',   p_gemeinde_id: gemeindeId }),
    svc.rpc('superadmin_produzentenaccounts', { p_rolle: 'verein',       p_gemeinde_id: gemeindeId }),
    svc.rpc('superadmin_produzentenaccounts', { p_rolle: 'organisation', p_gemeinde_id: gemeindeId }),
    svc.rpc('superadmin_produzentenaccounts', { p_rolle: 'gewerbe',      p_gemeinde_id: gemeindeId }),
    svc.rpc('superadmin_produzentenaccounts', { p_rolle: 'gemeinderat',  p_gemeinde_id: gemeindeId }),
  ])

  const buergerStats: BuergerStats = (buergerResult.data as BuergerStats) ?? EMPTY_BUERGER
  const rollenStats:  RolleStats[]  = (rollenResult.data  as RolleStats[]) ?? []
  const maengelStats: MaengelStats  = (maengelResult.data as MaengelStats) ?? EMPTY_MAENGEL
  const postsStats:   PostsStats    = (postsResult.data   as PostsStats)   ?? EMPTY_POSTS

  const produzentenAccounts: Record<string, ProduzentenAccount[]> = {
    verwaltung:   (verwaltungResult.data   as ProduzentenAccount[]) ?? [],
    verein:       (vereinResult.data       as ProduzentenAccount[]) ?? [],
    organisation: (organisationResult.data as ProduzentenAccount[]) ?? [],
    gewerbe:      (gewerbeResult.data      as ProduzentenAccount[]) ?? [],
    gemeinderat:  (gemeinderatResult.data  as ProduzentenAccount[]) ?? [],
  }

  const { score: healthScore, components: healthComponents } =
    computeHealthScore(buergerStats, rollenStats, maengelStats, postsStats)

  const data: DashboardData = {
    gemeinden:          (gemeindenResult.data ?? []) as import('./types').Gemeinde[],
    activeGemeindeId:   gemeindeId,
    buergerStats,
    rollenStats,
    maengelStats,
    postsStats,
    produzentenAccounts,
    healthScore,
    healthComponents,
  }

  return <AdminDashboardClient data={data} />
}
