'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DashboardData } from './types'
import { PRODUZENTEN_ROLLEN } from './types'
import HealthScoreCard from './HealthScoreCard'
import KpiKacheln from './KpiKacheln'
import RollenTabelle from './RollenTabelle'
import ProduzentenTab from './ProduzentenTab'
import AdminEinladungSection from './AdminEinladungSection'
import GemeindenSection from './GemeindenSection'

export default function AdminDashboardClient({ data }: { data: DashboardData }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<string>(PRODUZENTEN_ROLLEN[0].key)

  function handleGemeindeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    router.push(val ? `/admin/dashboard?gemeinde=${val}` : '/admin/dashboard')
  }

  const activeName = data.gemeinden.find(g => g.id === data.activeGemeindeId)?.name

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Super-Admin-Dashboard</h1>
            {activeName && (
              <p className="text-sm text-gray-500 mt-0.5">{activeName}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="gemeinde-select" className="text-sm text-gray-500 whitespace-nowrap">
              Gemeinde:
            </label>
            <select
              id="gemeinde-select"
              value={data.activeGemeindeId ?? ''}
              onChange={handleGemeindeChange}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Alle Gemeinden</option>
              {data.gemeinden.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Health Score */}
        <HealthScoreCard
          score={data.healthScore}
          components={data.healthComponents}
        />

        {/* KPI Kacheln */}
        <KpiKacheln
          buergerStats={data.buergerStats}
          rollenStats={data.rollenStats}
          postsStats={data.postsStats}
        />

        {/* Rollenübersicht */}
        <RollenTabelle
          buergerStats={data.buergerStats}
          rollenStats={data.rollenStats}
        />

        {/* Produzenten-Tabs */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="border-b border-gray-200 overflow-x-auto">
            <nav className="flex min-w-max" aria-label="Produzenten-Rollen">
              {PRODUZENTEN_ROLLEN.map(({ key, label }) => {
                const accounts = data.produzentenAccounts[key] ?? []
                const active   = accounts.filter(a => a.is_active).length
                const isActive = key === activeTab
                return (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`px-5 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      isActive
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {label}
                    <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {active}/{accounts.length}
                    </span>
                  </button>
                )
              })}
            </nav>
          </div>

          <div className="p-6">
            {PRODUZENTEN_ROLLEN.map(({ key }) => (
              key === activeTab ? (
                <ProduzentenTab
                  key={key}
                  rolle={key}
                  accounts={data.produzentenAccounts[key] ?? []}
                />
              ) : null
            ))}
          </div>
        </div>

        {/* Einladungen */}
        <AdminEinladungSection gemeinden={data.gemeinden} />

        {/* Gemeinden */}
        <GemeindenSection gemeinden={data.gemeinden} />

      </div>
    </div>
  )
}
