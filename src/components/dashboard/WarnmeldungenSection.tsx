'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldAlert, Plus, X, Loader2 } from 'lucide-react'
import { SEVERITY_LABEL, SEVERITY_COLOR, type WarnSeverity } from '@/features/warnmeldungen/types'
import AeltereSuche from '@/components/dashboard/AeltereSuche'

interface WarnRow {
  id: string
  titel: string
  severity: number | null
  is_active: boolean
  dwd_id: string | null
  created_at: string
}

interface Props {
  warnmeldungen: WarnRow[]
  gesamt: number
  aktiveVerborgen: number
}

export default function WarnmeldungenSection({ warnmeldungen: initial, gesamt, aktiveVerborgen }: Props) {
  const router = useRouter()
  const [warnmeldungen, setWarnmeldungen] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deactivating, setDeactivating] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const [titel, setTitel] = useState('')
  const [inhalt, setInhalt] = useState('')
  const [severity, setSeverity] = useState(2)
  const [sendPush, setSendPush] = useState(true)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setServerError(null)
    try {
      const res = await fetch('/api/warnmeldungen/erstellen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titel, inhalt, severity, sendPush }),
      })
      const result = await res.json()
      if (!res.ok) {
        setServerError(result.error ?? 'Fehler beim Erstellen der Warnmeldung')
        return
      }
      setTitel('')
      setInhalt('')
      setSeverity(2)
      setSendPush(true)
      setShowForm(false)
      router.refresh()
    } catch {
      setServerError('Unbekannter Fehler – bitte erneut versuchen.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeactivate(postId: string) {
    setDeactivating(postId)
    const res = await fetch('/api/warnmeldungen/deaktivieren', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: postId }),
    })
    if (res.ok) {
      setWarnmeldungen(prev => prev.map(w => w.id === postId ? { ...w, is_active: false } : w))
      setConfirmId(null)
    }
    setDeactivating(null)
  }

  const aktive = warnmeldungen.filter(w => w.is_active)
  const inaktive = warnmeldungen.filter(w => !w.is_active)

  return (
    <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between flex-wrap gap-x-3 gap-y-2 px-5 py-4 border-b border-gray-100">
        <h2 className="font-bold text-gray-900 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-red-500" aria-hidden="true" />
          Warnmeldungen
          <span className="text-xs text-gray-500 font-normal">
            {warnmeldungen.length} von {gesamt}
          </span>
          {aktive.length > 0 && (
            <span className="text-xs bg-red-100 text-red-600 font-semibold px-2 py-0.5 rounded-full">
              {aktive.length} aktiv
            </span>
          )}
        </h2>
        <button
          onClick={() => { setShowForm(v => !v); setServerError(null) }}
          className="flex items-center gap-1.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg transition-colors"
          aria-expanded={showForm}
        >
          {showForm ? <X className="w-3.5 h-3.5" aria-hidden="true" /> : <Plus className="w-3.5 h-3.5" aria-hidden="true" />}
          {showForm ? 'Abbrechen' : 'Neue Warnmeldung'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="px-5 py-4 border-b border-gray-100 bg-red-50 space-y-3">
          {serverError && (
            <div role="alert" aria-live="assertive" className="bg-red-100 text-red-700 rounded-lg px-3 py-2 text-sm">
              {serverError}
            </div>
          )}
          <div>
            <label htmlFor="warn-titel" className="text-xs font-medium text-gray-700 block mb-1">Titel</label>
            <input
              id="warn-titel"
              value={titel}
              onChange={e => setTitel(e.target.value)}
              placeholder="z.B. Unwetterwarnung: Starkregen"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
            />
          </div>
          <div>
            <label htmlFor="warn-inhalt" className="text-xs font-medium text-gray-700 block mb-1">Beschreibung</label>
            <textarea
              id="warn-inhalt"
              value={inhalt}
              onChange={e => setInhalt(e.target.value)}
              placeholder="Details zur Warnmeldung..."
              rows={3}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none bg-white"
            />
          </div>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label htmlFor="warn-severity" className="text-xs font-medium text-gray-700 block mb-1">Schweregrad</label>
              <select
                id="warn-severity"
                value={severity}
                onChange={e => setSeverity(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
              >
                {([1, 2, 3, 4] as const).map(s => (
                  <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={sendPush}
                onChange={e => setSendPush(e.target.checked)}
                className="w-4 h-4 text-red-600 rounded"
              />
              Push-Benachrichtigung senden
            </label>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-50 transition-colors"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
            Warnmeldung erstellen
          </button>
        </form>
      )}

      {warnmeldungen.length === 0 && !showForm ? (
        <p className="text-sm text-gray-400 text-center py-8">Keine Warnmeldungen vorhanden</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {[...aktive, ...inaktive].map(w => {
            const sev = (w.severity ?? 2) as WarnSeverity
            const color = SEVERITY_COLOR[sev]
            const label = SEVERITY_LABEL[sev]
            return (
              <li key={w.id} className={`flex items-center gap-3 px-5 py-3 ${!w.is_active ? 'opacity-40' : ''}`}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
                  <ShieldAlert className="w-4 h-4" style={{ color }} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 leading-snug truncate">{w.titel}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded-full" style={{ color, background: `${color}18` }}>{label}</span>
                    <span className="text-xs text-gray-400">{w.dwd_id ? 'DWD' : 'Manuell'}</span>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-400">{new Date(w.created_at).toLocaleDateString('de-DE')}</span>
                    {!w.is_active && <span className="text-xs text-gray-400 italic">inaktiv</span>}
                  </div>
                </div>
                {w.is_active && !w.dwd_id && (
                  confirmId === w.id ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-500">Deaktivieren?</span>
                      <button
                        onClick={() => handleDeactivate(w.id)}
                        disabled={deactivating === w.id}
                        className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                        aria-label="Deaktivierung bestätigen"
                      >
                        {deactivating === w.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : 'Ja'}
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Nein
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmId(w.id)}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors shrink-0"
                      aria-label={`Warnmeldung "${w.titel}" deaktivieren`}
                    >
                      Deaktivieren
                    </button>
                  )
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Die "aktive"-Abfrage in page.tsx ist auf 50 Zeilen gedeckelt. Anders
          als bei Maengeln/Fragen faellt eine verschluckte aktive Warnung
          sonst lautlos aus Liste UND "X aktiv"-Badge — bei Gefahreninformation
          wiegt das schwerer, deshalb hier derselbe Hinweis wie dort. */}
      {aktiveVerborgen > 0 && (
        <p className="px-5 py-2 text-xs text-gray-500 border-b border-gray-100">
          {aktiveVerborgen} weitere aktive Warnmeldungen — bitte über die Suche aufrufen
        </p>
      )}

      <AeltereSuche<{ id: string; titel: string; created_at: string }>
        typ="warnmeldungen"
        label="Ältere Warnmeldungen durchsuchen"
      >
        {treffer => (
          <ul className="divide-y divide-gray-50">
            {treffer.map(w => (
              <li key={w.id} className="py-2 flex items-center justify-between gap-3">
                <span className="text-sm text-gray-800 truncate">{w.titel}</span>
                <span className="text-xs text-gray-500 shrink-0">
                  {new Date(w.created_at).toLocaleDateString('de-DE')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </AeltereSuche>
    </section>
  )
}
