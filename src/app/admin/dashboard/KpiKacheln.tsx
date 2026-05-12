'use client'

import type { BuergerStats, RolleStats, PostsStats } from './types'

function pct(a: number, b: number) {
  if (b === 0) return '–'
  return `${Math.round((a / b) * 100)} %`
}

type KachelnProps = {
  buergerStats: BuergerStats
  rollenStats: RolleStats[]
  postsStats: PostsStats
}

export default function KpiKacheln({ buergerStats, rollenStats, postsStats }: KachelnProps) {
  const totalProduzenten = rollenStats.reduce((s, r) => s + r.account_count, 0)
  const activeProduzenten = rollenStats.reduce((s, r) => s + r.active_30d, 0)

  const kacheln = [
    {
      label: 'Registrierte Bürger',
      value: buergerStats.total.toLocaleString('de-DE'),
      sub: 'gesamt',
      color: 'bg-blue-50 border-blue-100',
    },
    {
      label: 'MAU',
      value: pct(buergerStats.mau, buergerStats.total),
      sub: `${buergerStats.mau} aktiv in 30 Tagen`,
      color: 'bg-indigo-50 border-indigo-100',
    },
    {
      label: '30-Tage-Retention',
      value: pct(buergerStats.retention_active, buergerStats.retention_eligible),
      sub: `${buergerStats.retention_active} / ${buergerStats.retention_eligible} Berechtigte`,
      color: 'bg-violet-50 border-violet-100',
    },
    {
      label: 'Aktive Produzenten',
      value: `${activeProduzenten} / ${totalProduzenten}`,
      sub: '≥ 1 Post in 30 Tagen',
      color: 'bg-amber-50 border-amber-100',
    },
    {
      label: 'Posts diese Woche',
      value: postsStats.posts_7d.toLocaleString('de-DE'),
      sub: `${postsStats.posts_30d} in 30 Tagen`,
      color: 'bg-emerald-50 border-emerald-100',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {kacheln.map(({ label, value, sub, color }) => (
        <div key={label} className={`rounded-2xl border p-4 ${color}`}>
          <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
          <p className="text-xs text-gray-400 mt-1">{sub}</p>
        </div>
      ))}
    </div>
  )
}
