'use client'

import { useState } from 'react'
import { BarChart2, ChevronDown, ChevronUp, Star } from 'lucide-react'
import UmfrageErstellenButton from './UmfrageErstellenButton'
import type { FrageErgebnis } from '@/types/umfrage'

interface Umfrage {
  id: string
  titel: string
  enddatum: string
}

interface UmfrageMitErgebnis {
  umfrage: Umfrage
  ergebnisse: FrageErgebnis[]
  teilnehmer: number
}

interface Props {
  umfragen: UmfrageMitErgebnis[]
  gemeindeId: string
  haushalte: number | null
}

export default function UmfragenSection({ umfragen, gemeindeId, haushalte }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="font-bold text-gray-900 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-primary-500" />
          Umfragen
          <span className="text-xs text-gray-400 font-normal">({umfragen.length})</span>
        </h2>
        <UmfrageErstellenButton gemeindeId={gemeindeId} />
      </div>

      {umfragen.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Noch keine Umfragen erstellt</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {umfragen.map(({ umfrage, ergebnisse, teilnehmer }) => {
            const abgelaufen = new Date(umfrage.enddatum) < new Date()
            const isOpen = expandedId === umfrage.id
            const beteiligung = haushalte
              ? Math.min(100, Math.round((teilnehmer / haushalte) * 100))
              : null

            return (
              <li key={umfrage.id}>
                <button
                  onClick={() => abgelaufen && setExpandedId(isOpen ? null : umfrage.id)}
                  className={`w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors ${abgelaufen ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{umfrage.titel}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {teilnehmer} Teilnehmer
                      {beteiligung !== null && <span className="ml-2 text-primary-500 font-medium">{beteiligung}% der Haushalte</span>}
                      <span className="ml-2">{new Date(umfrage.enddatum).toLocaleDateString('de-DE')}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${abgelaufen ? 'bg-gray-100 text-gray-500' : 'bg-primary-100 text-primary-600'}`}>
                      {abgelaufen ? 'Beendet' : 'Aktiv'}
                    </span>
                    {abgelaufen && (
                      isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </button>

                {!abgelaufen && (
                  <p className="px-5 pb-3 text-xs text-gray-400 italic">
                    Ergebnisse erst nach Abschluss sichtbar
                  </p>
                )}

                {abgelaufen && isOpen && (
                  <div className="px-5 pb-5 space-y-4">
                    {ergebnisse.map(ergebnis => (
                      <div key={ergebnis.frage_id} className="border-t border-gray-100 pt-3">
                        <p className="text-xs font-semibold text-gray-700 mb-2">{ergebnis.frage_text}</p>

                        {ergebnis.typ === 'bewertung' ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <div className="flex gap-0.5">
                                {[1,2,3,4,5].map(i => (
                                  <Star key={i} className={`w-3.5 h-3.5 ${i <= Math.round(ergebnis.durchschnitt ?? 0) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
                                ))}
                              </div>
                              <span className="text-sm font-bold text-gray-700">{ergebnis.durchschnitt?.toFixed(1)} / 5</span>
                              <span className="text-xs text-gray-400">({ergebnis.gesamt_antworten} Antworten)</span>
                            </div>
                            {ergebnis.optionen.map(o => (
                              <div key={o.label} className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 w-4">{o.label}</span>
                                <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                  <div className="bg-amber-400 h-1.5 rounded-full" style={{ width: `${o.prozent}%` }} />
                                </div>
                                <span className="text-xs text-gray-500 w-8 text-right">{o.prozent}%</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {ergebnis.optionen.map(o => (
                              <div key={o.label}>
                                <div className="flex justify-between text-xs mb-0.5">
                                  <span className="text-gray-700">{o.label}</span>
                                  <span className="text-gray-400">{o.anzahl} ({o.prozent}%)</span>
                                </div>
                                <div className="bg-gray-100 rounded-full h-2">
                                  <div className="bg-primary-500 h-2 rounded-full" style={{ width: `${o.prozent}%` }} />
                                </div>
                              </div>
                            ))}
                            <p className="text-xs text-gray-400 pt-0.5">{ergebnis.gesamt_antworten} Antworten gesamt</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
