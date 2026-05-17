export type BuergerStats = {
  total: number
  mau: number
  retention_eligible: number
  retention_active: number
}

export type RolleStats = {
  role: string
  account_count: number
  posts_7d: number
  posts_30d: number
  active_30d: number
}

export type MaengelStats = {
  total: number
  erledigt: number
}

export type PostsStats = {
  posts_7d: number
  posts_30d: number
}

export type ProduzentenAccount = {
  id: string
  name: string
  posts_7d: number
  posts_30d: number
  subscribers: number | null
  is_active: boolean
}

export type HealthComponents = {
  mauScore: number
  retentionScore: number
  maengelScore: number
  prodAktivScore: number
  postsScore: number
}

export type Gemeinde = {
  id: string
  name: string
  slug: string
  bundesland: string
  plz: string | null
  einwohner: number | null
}

export type DashboardData = {
  gemeinden: Gemeinde[]
  activeGemeindeId: string | null
  buergerStats: BuergerStats
  rollenStats: RolleStats[]
  maengelStats: MaengelStats
  postsStats: PostsStats
  produzentenAccounts: Record<string, ProduzentenAccount[]>
  healthScore: number
  healthComponents: HealthComponents
}

export const PRODUZENTEN_ROLLEN = [
  { key: 'verwaltung',  label: 'Verwaltung'  },
  { key: 'verein',      label: 'Verein'      },
  { key: 'organisation', label: 'Organisation' },
  { key: 'gewerbe',     label: 'Gewerbe'     },
  { key: 'gemeinderat', label: 'Gemeinderat' },
] as const

export const ALLE_ROLLEN = [
  ...PRODUZENTEN_ROLLEN,
  { key: 'buerger', label: 'Bürger' },
] as const
