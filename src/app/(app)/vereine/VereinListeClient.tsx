'use client'

import { useState, useMemo } from 'react'
import { Search, X, Users } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
import { VereinCard } from '@/features/verein'
import type { VereinMitKategorie, VereinKategorie, Profile } from '@/types/database'

interface Props {
  vereine: VereinMitKategorie[]
  kategorien: VereinKategorie[]
  profile: (Profile & { gemeinden?: { name: string } | null }) | null
  abonnements: string[]
}

export default function VereinListeClient({ vereine, kategorien, profile, abonnements }: Props) {
  const [suche, setSuche] = useState('')
  const [kategorieFilter, setKategorieFilter] = useState<string | null>(null)
  const [filterOffen, setFilterOffen] = useState(false)

  const gemeindeName = profile?.gemeinden?.name ?? ''

  const gefiltert = useMemo(() => {
    return vereine.filter(v => {
      if (suche && !v.verein_name.toLowerCase().includes(suche.toLowerCase())) return false
      if (kategorieFilter && v.kategorie_id !== kategorieFilter) return false
      return true
    })
  }, [vereine, suche, kategorieFilter])

  const aktiveFilter = kategorieFilter ? 1 : 0

  return (
    <div>
      <PageHeader
        gemeindeName={gemeindeName}
        title="Vereine & Organisationen"
        actions={
          kategorien.length > 0 ? (
            <button
              onClick={() => setFilterOffen(o => !o)}
              className="relative flex items-center gap-1.5 bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-xl"
            >
              Filtern
              {aktiveFilter > 0 && (
                <span className="w-4 h-4 bg-violet-400 rounded-full text-white text-[10px] flex items-center justify-center font-black">
                  {aktiveFilter}
                </span>
              )}
            </button>
          ) : undefined
        }
      />

      <div className="p-4 space-y-4 pt-4">
        {/* Suchfeld */}
        <div role="search" className="relative">
          <label htmlFor="verein-suche" className="sr-only">Verein oder Organisation suchen</label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
          <input
            id="verein-suche"
            value={suche}
            onChange={e => setSuche(e.target.value)}
            placeholder="Verein oder Organisation suchen …"
            type="search"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {suche && (
            <button onClick={() => setSuche('')} aria-label="Suche leeren" className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-gray-400" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Kategorie-Chips (≤9 direkt, sonst Bottom Sheet) */}
        {kategorien.length > 0 && kategorien.length <= 9 && (
          <div className="flex gap-2 flex-wrap">
            {kategorien.map(k => (
              <button
                key={k.id}
                onClick={() => setKategorieFilter(prev => prev === k.id ? null : k.id)}
                className={`text-xs font-bold px-3 py-1.5 rounded-full border-2 transition-colors ${
                  kategorieFilter === k.id
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'border-gray-200 text-gray-600 bg-white'
                }`}
              >
                {k.name}
              </button>
            ))}
          </div>
        )}

        {/* Ergebnisse */}
        {gefiltert.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Keine Einträge gefunden"
            description={
              suche || kategorieFilter
                ? 'Versuche eine andere Suche.'
                : 'In Ihrer Gemeinde sind noch keine Vereine oder Organisationen registriert.'
            }
          />
        ) : (
          <div className="space-y-3">
            {gefiltert.map(verein => (
              <VereinCard
                key={verein.id}
                verein={verein}
                istAbonniert={abonnements.includes(verein.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Filter Bottom Sheet (>9 Kategorien) */}
      {filterOffen && kategorien.length > 9 && (
        <div
          className="fixed inset-0 bg-black/60 z-[60] flex items-end justify-center"
          onClick={() => setFilterOffen(false)}
        >
          <div
            className="bg-white w-full max-w-lg rounded-t-2xl max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white">
              <h2 className="font-black text-gray-900 uppercase tracking-wide text-sm">Kategorie filtern</h2>
              <div className="flex items-center gap-3">
                {kategorieFilter && (
                  <button onClick={() => setKategorieFilter(null)} className="text-xs text-primary-500 font-bold">
                    Zurücksetzen
                  </button>
                )}
                <button onClick={() => setFilterOffen(false)}>
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
            <div className="p-5 space-y-2 pb-8">
              {kategorien.map(k => (
                <button
                  key={k.id}
                  onClick={() => { setKategorieFilter(prev => prev === k.id ? null : k.id); setFilterOffen(false) }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 text-sm font-bold transition-colors ${
                    kategorieFilter === k.id
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'border-gray-200 text-gray-700'
                  }`}
                >
                  {k.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
