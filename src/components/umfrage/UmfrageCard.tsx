'use client'

import { useState } from 'react'
import { Umfrage, UmfrageAntwort, FrageTyp } from '@/types/umfrage'
import { Profile } from '@/types/database'
import { BarChart2, Clock, ChevronDown, ChevronUp, Loader2, CheckCircle2, Pencil, Trash2 } from 'lucide-react'
import { clsx } from 'clsx'
import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'
import UmfrageErstellen from './UmfrageErstellen'

interface Props {
  umfrage: Umfrage
  hatAbgestimmt: boolean
  teilnehmerAnzahl: number
  profile: Profile | null
  onDelete?: (id: string) => void
  onUpdate?: (umfrage: Umfrage) => void
}

export default function UmfrageCard({ umfrage: initialUmfrage, hatAbgestimmt: initialHatAbgestimmt, teilnehmerAnzahl: initialTeilnehmer, profile, onDelete, onUpdate }: Props) {
  const [umfrage, setUmfrage] = useState(initialUmfrage)
  const [isExpanded, setIsExpanded] = useState(false)
  const [hatAbgestimmt, setHatAbgestimmt] = useState(initialHatAbgestimmt)
  const [teilnehmer, setTeilnehmer] = useState(initialTeilnehmer)
  const [antworten, setAntworten] = useState<Record<string, UmfrageAntwort[]>>({})
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [error, setError] = useState('')

  const isVerwaltung = profile?.role === 'verwaltung' || profile?.role === 'super_admin'
  const abgelaufen = new Date(umfrage.enddatum) < new Date()
  const fragen = umfrage.umfrage_fragen ?? []
  const kannNichtAbstimmen = hatAbgestimmt || abgelaufen || !profile

  function setAntwort(frageId: string, antwort: UmfrageAntwort, mehrfach = false) {
    setAntworten(prev => {
      if (mehrfach) {
        const aktuell = prev[frageId] ?? []
        const exists = aktuell.find(a => a.option_id === antwort.option_id)
        return {
          ...prev,
          [frageId]: exists
            ? aktuell.filter(a => a.option_id !== antwort.option_id)
            : [...aktuell, antwort],
        }
      }
      return { ...prev, [frageId]: [antwort] }
    })
  }

  async function abstimmen() {
    const alleAntworten = fragen.flatMap(f => antworten[f.id] ?? [])
    if (alleAntworten.length === 0) { setError('Bitte beantworte mindestens eine Frage.'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/umfragen/abstimmen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ umfrageId: umfrage.id, antworten: alleAntworten }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTeilnehmer(t => t + 1)
      setHatAbgestimmt(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Abstimmen')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Umfrage wirklich löschen?')) return
    setDeleting(true)
    try {
      const res = await fetch('/api/umfragen/loeschen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ umfrageId: umfrage.id }),
      })
      if (!res.ok) throw new Error()
      onDelete?.(umfrage.id)
    } catch {
      alert('Fehler beim Löschen')
    } finally {
      setDeleting(false)
    }
  }

  function handleUpdated(updated: Umfrage) {
    setUmfrage(updated)
    onUpdate?.(updated)
  }

  return (
    <>
      {showEditForm && (
        <UmfrageErstellen
          gemeindeId={umfrage.gemeinde_id}
          onClose={() => setShowEditForm(false)}
          onCreated={handleUpdated}
          existingUmfrage={umfrage}
        />
      )}

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 border-primary-500">
        {/* Header */}
        <div className="p-4 pb-3">
          <div className="flex items-start justify-between gap-3 mb-2">
            <button
              className="flex items-center gap-2 flex-wrap flex-1 text-left"
              onClick={() => setIsExpanded(v => !v)}
            >
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-primary-100 text-primary-600">
                Umfrage
              </span>
              {abgelaufen
                ? <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Beendet</span>
                : <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    Noch {formatDistanceToNow(new Date(umfrage.enddatum), { locale: de })}
                  </span>
              }
            </button>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-gray-400">{teilnehmer} Teilnehmer</span>
              <button onClick={() => setIsExpanded(v => !v)}>
                {isExpanded
                  ? <ChevronUp className="w-4 h-4 text-gray-400" />
                  : <ChevronDown className="w-4 h-4 text-gray-400" />
                }
              </button>
            </div>
          </div>
          <button className="text-left w-full" onClick={() => setIsExpanded(v => !v)}>
            <h2 className="font-bold text-gray-900 text-base">{umfrage.titel}</h2>
            {umfrage.beschreibung && <p className="text-sm text-gray-500 mt-1">{umfrage.beschreibung}</p>}
          </button>
        </div>

        {/* Ausgeklappter Inhalt */}
        {isExpanded && (
          <div className="px-4 pb-4 space-y-5 border-t border-gray-100 pt-4">
            {hatAbgestimmt ? (
              <div className="flex items-center gap-3 py-4 justify-center">
                <CheckCircle2 className="w-6 h-6 text-primary-500" />
                <p className="text-sm font-medium text-gray-700">Vielen Dank für Ihre Teilnahme!</p>
              </div>
            ) : abgelaufen ? (
              <p className="text-sm text-gray-400 text-center py-4">Diese Umfrage ist abgeschlossen.</p>
            ) : (
              <>
                {fragen
                  .sort((a, b) => a.reihenfolge - b.reihenfolge)
                  .map((frage, idx) => (
                    <div key={frage.id}>
                      <p className="text-sm font-semibold text-gray-800 mb-2">
                        {idx + 1}. {frage.frage_text}
                      </p>
                      <Abstimmung
                        frage={frage}
                        antworten={antworten[frage.id] ?? []}
                        onChange={(a, mehrfach) => setAntwort(frage.id, a, mehrfach)}
                      />
                    </div>
                  ))}

                {error && <p className="text-red-500 text-sm">{error}</p>}

                {!kannNichtAbstimmen && (
                  <button
                    onClick={abstimmen}
                    disabled={loading}
                    className="w-full bg-primary-500 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart2 className="w-4 h-4" />}
                    Abstimmen
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Abstimmungs-UI ───────────────────────────────────────────────────────────

function Abstimmung({ frage, antworten, onChange }: {
  frage: Umfrage['umfrage_fragen'] extends (infer T)[] | undefined ? T : never
  antworten: UmfrageAntwort[]
  onChange: (a: UmfrageAntwort, mehrfach?: boolean) => void
}) {
  if (!frage) return null
  const typ = frage.typ as FrageTyp

  if (typ === 'ja_nein') {
    return (
      <div className="flex gap-3">
        {['ja', 'nein'].map(val => (
          <button
            key={val}
            onClick={() => onChange({ frage_id: frage.id, antwort_text: val })}
            className={clsx(
              'flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-colors',
              antworten[0]?.antwort_text === val
                ? 'border-primary-500 bg-primary-50 text-primary-600'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            )}
          >
            {val === 'ja' ? '✓ Ja' : '✗ Nein'}
          </button>
        ))}
      </div>
    )
  }

  if (typ === 'bewertung') {
    return (
      <div className="flex gap-2 justify-center">
        {[1, 2, 3, 4, 5].map(val => (
          <button
            key={val}
            onClick={() => onChange({ frage_id: frage.id, antwort_text: String(val) })}
            className={clsx(
              'w-10 h-10 rounded-xl border-2 text-sm font-bold transition-colors',
              antworten[0]?.antwort_text === String(val)
                ? 'border-amber-400 bg-amber-50 text-amber-600'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            )}
          >
            {val}
          </button>
        ))}
      </div>
    )
  }

  const optionen = frage.umfrage_optionen ?? []
  const mehrfach = typ === 'mehrfachauswahl'

  return (
    <div className="space-y-2">
      {optionen.sort((a, b) => a.reihenfolge - b.reihenfolge).map(opt => {
        const selected = antworten.some(a => a.option_id === opt.id)
        return (
          <button
            key={opt.id}
            onClick={() => onChange({ frage_id: frage.id, option_id: opt.id }, mehrfach)}
            className={clsx(
              'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 text-sm text-left transition-colors',
              selected ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-gray-200 text-gray-700 hover:border-gray-300'
            )}
          >
            <span className={clsx(
              'w-5 h-5 rounded flex items-center justify-center shrink-0 border-2 transition-colors',
              mehrfach ? 'rounded' : 'rounded-full',
              selected ? 'border-primary-500 bg-primary-500' : 'border-gray-300'
            )}>
              {selected && <span className="text-white text-xs">✓</span>}
            </span>
            {opt.option_text}
          </button>
        )
      })}
      {mehrfach && <p className="text-xs text-gray-400">Mehrere Antworten möglich</p>}
    </div>
  )
}

