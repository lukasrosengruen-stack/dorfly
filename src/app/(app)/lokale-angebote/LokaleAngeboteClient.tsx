'use client'

import { useState, useMemo } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
import { GewerbeCard } from '@/features/gewerbe'
import { Building2 } from 'lucide-react'
import type { OrganisationMitBranche, Gewerbebranche, Profile } from '@/types/database'

interface Props {
  betriebe: OrganisationMitBranche[]
  branchen: Gewerbebranche[]
  profile: (Profile & { gemeinden?: { name: string } | null }) | null
  abonnements: string[]
}

export default function LokaleAngeboteClient({ betriebe, branchen, profile, abonnements }: Props) {
  const [suche, setSuche] = useState('')
  const [brancheFilter, setBrancheFilter] = useState<string | null>(null)
  const [filterOffen, setFilterOffen] = useState(false)

  const gemeindeName = profile?.gemeinden?.name ?? ''

  const gefiltert = useMemo(() => {
    return betriebe.filter(b => {
      if (suche && !b.name.toLowerCase().includes(suche.toLowerCase())) return false
      if (brancheFilter && b.branche_id !== brancheFilter) return false
      return true
    })
  }, [betriebe, suche, brancheFilter])

  const aktiveFilter = brancheFilter ? 1 : 0

  return (
    <div>
      <PageHeader
        gemeindeName={gemeindeName}
        title="Lokale Angebote"
        actions={
          branchen.length > 0 ? (
            <button
              onClick={() => setFilterOffen(o => !o)}
              className="relative flex items-center gap-1.5 bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-xl"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filtern
              {aktiveFilter > 0 && (
                <span className="w-4 h-4 bg-orange-400 rounded-full text-white text-[10px] flex items-center justify-center font-black">
                  {aktiveFilter}
                </span>
              )}
            </button>
          ) : undefined
        }
      />

      <div className="p-4 space-y-4 pt-4">
        {/* Suchfeld */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={suche}
            onChange={e => setSuche(e.target.value)}
            placeholder="Betrieb suchen …"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {suche && (
            <button onClick={() => setSuche('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>

        {/* Branche-Chips (≤6 Branchen direkt, sonst Bottom Sheet) */}
        {branchen.length > 0 && branchen.length <= 6 && (
          <div className="flex gap-2 flex-wrap">
            {branchen.map(b => (
              <button
                key={b.id}
                onClick={() => setBrancheFilter(prev => prev === b.id ? null : b.id)}
                className={`text-xs font-bold px-3 py-1.5 rounded-full border-2 transition-colors ${
                  brancheFilter === b.id
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'border-gray-200 text-gray-600 bg-white'
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>
        )}

        {/* Ergebnisse */}
        {gefiltert.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Keine Betriebe gefunden"
            description={suche || brancheFilter ? 'Versuche eine andere Suche.' : 'In Ihrer Gemeinde sind noch keine Betriebe registriert.'}
          />
        ) : (
          <div className="space-y-3">
            {gefiltert.map(betrieb => (
              <GewerbeCard key={betrieb.id} betrieb={betrieb} istAbonniert={abonnements.includes(betrieb.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Filter Bottom Sheet (>6 Branchen) */}
      {filterOffen && branchen.length > 6 && (
        <div
          className="fixed inset-0 bg-black/60 z-[60] flex items-end justify-center"
          onClick={() => setFilterOffen(false)}
        >
          <div
            className="bg-white w-full max-w-lg rounded-t-2xl max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white">
              <h2 className="font-black text-gray-900 uppercase tracking-wide text-sm">Branche filtern</h2>
              <div className="flex items-center gap-3">
                {brancheFilter && (
                  <button onClick={() => setBrancheFilter(null)} className="text-xs text-primary-500 font-bold">
                    Zurücksetzen
                  </button>
                )}
                <button onClick={() => setFilterOffen(false)}>
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
            <div className="p-5 space-y-2 pb-8">
              {branchen.map(b => (
                <button
                  key={b.id}
                  onClick={() => { setBrancheFilter(prev => prev === b.id ? null : b.id); setFilterOffen(false) }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 text-sm font-bold transition-colors ${
                    brancheFilter === b.id
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'border-gray-200 text-gray-700'
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
