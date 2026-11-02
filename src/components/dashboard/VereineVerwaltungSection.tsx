'use client'

import { useCallback, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'
import MitgliederSection from './MitgliederSection'
import type { TeamDaten, VereinsEintrag, ZielTyp } from '@/lib/mitgliedschaft'

const TYP_LABEL: Record<ZielTyp, string> = { verein: 'Verein', organisation: 'Organisation', gewerbe: 'Gewerbe' }

export default function VereineVerwaltungSection({ eintraege: start }: { eintraege: VereinsEintrag[] }) {
  const [eintraege, setEintraege] = useState(start)
  const [offen, setOffen] = useState<string | null>(null)

  // Zähler aktualisieren, wenn im aufgeklappten Eintrag Mitglieder geändert werden
  const aktualisiere = useCallback((d: TeamDaten) => {
    const id = d.ziel.verein_id ?? d.ziel.organisation_id
    setEintraege(liste => liste.map(e => e.id === id
      ? { ...e, mitglieder: d.mitglieder.length, verwalter: d.mitglieder.filter(m => m.rolle === 'verwalter').length }
      : e))
  }, [])

  // Ohne Verwalter zuerst, sonst alphabetisch
  const sortiert = [...eintraege].sort((a, b) =>
    Number(a.verwalter > 0) - Number(b.verwalter > 0) || a.name.localeCompare(b.name, 'de'))

  return (
    <section aria-labelledby="vereine-verwaltung-titel" className="bg-white rounded-2xl shadow-sm p-6">
      <h2 id="vereine-verwaltung-titel" className="font-bold text-gray-900 mb-1">Vereine & Gewerbe</h2>
      <p className="text-sm text-gray-600 mb-4">
        Mitglieder hinzufügen oder entfernen, Verantwortliche wechseln, Einträge löschen.
      </p>

      {sortiert.length === 0 && <p className="text-sm text-gray-600">Noch keine Vereine oder Gewerbe angelegt.</p>}

      <ul className="divide-y divide-gray-100">
        {sortiert.map(e => {
          const aufgeklappt = offen === e.id
          const panelId = `verein-panel-${e.id}`
          return (
            <li key={e.id}>
              <button
                type="button"
                aria-expanded={aufgeklappt}
                aria-controls={panelId}
                onClick={() => setOffen(aufgeklappt ? null : e.id)}
                className="w-full flex items-center gap-3 py-3 text-left"
              >
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-gray-900 truncate">{e.name}</span>
                  <span className="block text-xs text-gray-600">
                    {TYP_LABEL[e.typ]} · {e.mitglieder} {e.mitglieder === 1 ? 'Mitglied' : 'Mitglieder'}
                  </span>
                </span>
                {e.verwalter === 0 && (
                  <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full">Kein Verwalter</span>
                )}
                <ChevronDown aria-hidden="true" className={clsx('w-4 h-4 text-gray-500 transition-transform', aufgeklappt && 'rotate-180')} />
              </button>
              {aufgeklappt && (
                <div id={panelId} className="pb-6">
                  <MitgliederSection
                    ziel={e.typ === 'gewerbe' ? { organisation_id: e.id } : { verein_id: e.id }}
                    onGeladen={aktualisiere}
                    onGeloescht={() => {
                      setEintraege(liste => liste.filter(x => x.id !== e.id))
                      setOffen(null)
                    }}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
