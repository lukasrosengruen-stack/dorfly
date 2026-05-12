'use client'

import type { BuergerStats, RolleStats } from './types'
import { ALLE_ROLLEN } from './types'

type Props = {
  buergerStats: BuergerStats
  rollenStats: RolleStats[]
}

function pct(a: number, b: number) {
  if (b === 0) return '–'
  return `${Math.round((a / b) * 100)} %`
}

export default function RollenTabelle({ buergerStats, rollenStats }: Props) {
  const byRole = Object.fromEntries(rollenStats.map(r => [r.role, r]))

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">Rollenübersicht</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-6 py-3 font-medium text-gray-500">Rolle</th>
              <th className="px-4 py-3 font-medium text-gray-500 text-right">Accounts</th>
              <th className="px-4 py-3 font-medium text-gray-500 text-right">Posts 7 Tage</th>
              <th className="px-4 py-3 font-medium text-gray-500 text-right">Posts 30 Tage</th>
              <th className="px-4 py-3 font-medium text-gray-500 text-right">Aktivierungsrate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ALLE_ROLLEN.map(({ key, label }) => {
              if (key === 'buerger') {
                const mauRate = pct(buergerStats.mau, buergerStats.total)
                return (
                  <tr key={key} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-gray-900">{label}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                      {buergerStats.total.toLocaleString('de-DE')}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 italic text-xs" colSpan={2}>
                      MAU-Rate
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-900">
                      {mauRate}
                    </td>
                  </tr>
                )
              }

              const r = byRole[key]
              if (!r) {
                return (
                  <tr key={key} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-gray-900">{label}</td>
                    <td className="px-4 py-3 text-right text-gray-400">0</td>
                    <td className="px-4 py-3 text-right text-gray-400">0</td>
                    <td className="px-4 py-3 text-right text-gray-400">0</td>
                    <td className="px-4 py-3 text-right text-gray-400">–</td>
                  </tr>
                )
              }

              return (
                <tr key={key} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 font-medium text-gray-900">{label}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                    {r.account_count.toLocaleString('de-DE')}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                    {r.posts_7d.toLocaleString('de-DE')}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                    {r.posts_30d.toLocaleString('de-DE')}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-900">
                    {pct(r.active_30d, r.account_count)}
                    <span className="text-gray-400 font-normal ml-1 text-xs">
                      ({r.active_30d}/{r.account_count})
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
