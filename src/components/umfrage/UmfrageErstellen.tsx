'use client'

import { useState } from 'react'
import { Umfrage, FrageTyp } from '@/types/umfrage'
import { X, Plus, Trash2, GripVertical, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'

const TYP_META: Record<FrageTyp, string> = {
  ja_nein:        'Ja / Nein',
  einzelauswahl:  'Einzelauswahl',
  mehrfachauswahl:'Mehrfachauswahl',
  bewertung:      'Bewertung 1–5',
}

interface FormFrage {
  tempId: string
  frage_text: string
  typ: FrageTyp
  optionen: string[]
}

interface Props {
  gemeindeId: string
  onClose: () => void
  onCreated: (umfrage: Umfrage) => void
  existingUmfrage?: Umfrage
}

function fragenAusUmfrage(umfrage: Umfrage): FormFrage[] {
  return (umfrage.umfrage_fragen ?? [])
    .sort((a, b) => a.reihenfolge - b.reihenfolge)
    .map(f => ({
      tempId: crypto.randomUUID(),
      frage_text: f.frage_text,
      typ: f.typ,
      optionen: f.umfrage_optionen?.map(o => o.option_text) ?? ['', ''],
    }))
}

export default function UmfrageErstellen({ gemeindeId, onClose, onCreated, existingUmfrage }: Props) {
  const isEdit = !!existingUmfrage

  const [titel, setTitel] = useState(existingUmfrage?.titel ?? '')
  const [beschreibung, setBeschreibung] = useState(existingUmfrage?.beschreibung ?? '')
  const [enddatum, setEnddatum] = useState(
    existingUmfrage ? new Date(existingUmfrage.enddatum).toISOString().slice(0, 16) : ''
  )
  const [fragen, setFragen] = useState<FormFrage[]>(
    existingUmfrage ? fragenAusUmfrage(existingUmfrage) : [neeFrage()]
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function neeFrage(): FormFrage {
    return { tempId: crypto.randomUUID(), frage_text: '', typ: 'ja_nein', optionen: ['', ''] }
  }

  function addFrage() {
    if (fragen.length >= 50) return
    setFragen(f => [...f, neeFrage()])
  }

  function removeFrage(tempId: string) {
    setFragen(f => f.filter(q => q.tempId !== tempId))
  }

  function updateFrage(tempId: string, update: Partial<FormFrage>) {
    setFragen(f => f.map(q => q.tempId === tempId ? { ...q, ...update } : q))
  }

  function addOption(tempId: string) {
    setFragen(f => f.map(q => q.tempId === tempId ? { ...q, optionen: [...q.optionen, ''] } : q))
  }

  function updateOption(tempId: string, idx: number, val: string) {
    setFragen(f => f.map(q => q.tempId === tempId
      ? { ...q, optionen: q.optionen.map((o, i) => i === idx ? val : o) }
      : q
    ))
  }

  function removeOption(tempId: string, idx: number) {
    setFragen(f => f.map(q => q.tempId === tempId
      ? { ...q, optionen: q.optionen.filter((_, i) => i !== idx) }
      : q
    ))
  }

  async function submit() {
    if (!titel || !enddatum || fragen.some(f => !f.frage_text)) {
      setError('Bitte Titel, Enddatum und alle Fragen ausfüllen.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const fragenPayload = fragen.map((f, i) => ({
        reihenfolge: i + 1,
        frage_text: f.frage_text,
        typ: f.typ,
        umfrage_optionen: ['einzelauswahl', 'mehrfachauswahl'].includes(f.typ)
          ? f.optionen.filter(Boolean).map((o, j) => ({ option_text: o, reihenfolge: j + 1 }))
          : [],
      }))

      const url = isEdit ? '/api/umfragen/bearbeiten' : '/api/umfragen/erstellen'
      const body = isEdit
        ? { umfrageId: existingUmfrage.id, titel, beschreibung, enddatum: new Date(enddatum).toISOString(), fragen: fragenPayload }
        : { titel, beschreibung, enddatum: new Date(enddatum).toISOString(), gemeindeId, fragen: fragenPayload }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onCreated(data.umfrage)
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-4 border-b sticky top-0 bg-white z-10">
          <h2 className="font-bold text-gray-900">{isEdit ? 'Umfrage bearbeiten' : 'Neue Umfrage'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        <div className="p-4 space-y-4">
          <input
            placeholder="Titel der Umfrage"
            value={titel}
            onChange={e => setTitel(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <textarea
            placeholder="Beschreibung (optional)"
            value={beschreibung}
            onChange={e => setBeschreibung(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Enddatum</label>
            <input
              type="datetime-local"
              value={enddatum}
              onChange={e => setEnddatum(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-gray-800">Fragen ({fragen.length}/50)</h3>

            {fragen.map((frage, idx) => (
              <div key={frage.tempId} className="border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
                  <span className="text-xs font-medium text-gray-400">Frage {idx + 1}</span>
                  {fragen.length > 1 && (
                    <button onClick={() => removeFrage(frage.tempId)} className="ml-auto text-gray-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <input
                  placeholder="Fragetext"
                  value={frage.frage_text}
                  onChange={e => updateFrage(frage.tempId, { frage_text: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />

                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(TYP_META) as [FrageTyp, string][]).map(([typ, label]) => (
                    <button
                      key={typ}
                      onClick={() => updateFrage(frage.tempId, { typ })}
                      className={clsx(
                        'py-2 px-3 rounded-xl border-2 text-xs font-medium transition-colors text-left',
                        frage.typ === typ ? 'border-primary-500 bg-primary-50 text-primary-600' : 'border-gray-200 text-gray-500'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {['einzelauswahl', 'mehrfachauswahl'].includes(frage.typ) && (
                  <div className="space-y-2">
                    {frage.optionen.map((opt, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          placeholder={`Option ${i + 1}`}
                          value={opt}
                          onChange={e => updateOption(frage.tempId, i, e.target.value)}
                          className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        {frage.optionen.length > 2 && (
                          <button onClick={() => removeOption(frage.tempId, i)} className="text-gray-400 hover:text-red-500">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => addOption(frage.tempId)}
                      className="text-sm text-primary-500 font-medium flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Option hinzufügen
                    </button>
                  </div>
                )}
              </div>
            ))}

            {fragen.length < 50 && (
              <button
                onClick={addFrage}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-500 flex items-center justify-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" /> Frage hinzufügen
              </button>
            )}
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            onClick={submit}
            disabled={loading}
            className="w-full bg-primary-500 text-white font-semibold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? 'Änderungen speichern' : 'Umfrage veröffentlichen'}
          </button>
        </div>
      </div>
    </div>
  )
}

