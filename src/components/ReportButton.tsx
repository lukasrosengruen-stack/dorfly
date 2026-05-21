'use client'

import { useState } from 'react'
import { Flag, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { clsx } from 'clsx'
import { useFocusTrap } from '@/hooks/useFocusTrap'

const GRUENDE = [
  { value: 'illegal',     label: 'Rechtswidrige Inhalte' },
  { value: 'spam',        label: 'Spam oder Werbung' },
  { value: 'beleidigung', label: 'Beleidigung / Hassrede' },
  { value: 'falsch',      label: 'Falschinformation' },
  { value: 'sonstiges',   label: 'Sonstiges' },
] as const

type Grund = typeof GRUENDE[number]['value']

interface Props {
  inhaltTyp: 'post' | 'mangel' | 'frage' | 'antwort'
  inhaltId: string
}

export default function ReportButton({ inhaltTyp, inhaltId }: Props) {
  const [open, setOpen] = useState(false)
  const [grund, setGrund] = useState<Grund | ''>('')
  const [beschreibung, setBeschreibung] = useState('')
  const [loading, setLoading] = useState(false)
  const trapRef = useFocusTrap(open)

  function handleClose() {
    setOpen(false)
    setGrund('')
    setBeschreibung('')
  }

  async function submit() {
    if (!grund) return
    setLoading(true)
    try {
      const res = await fetch('/api/melden', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inhaltTyp, inhaltId, grund, beschreibung }),
      })
      if (!res.ok) throw new Error()
      toast.success('Meldung wurde eingereicht')
      handleClose()
    } catch {
      toast.error('Fehler beim Einreichen der Meldung')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Inhalt melden (DSA)"
        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
      >
        <Flag className="w-3.5 h-3.5" aria-hidden="true" />
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-[100] flex items-end sm:items-center justify-center p-4"
          onClick={handleClose}
          onKeyDown={e => e.key === 'Escape' && handleClose()}
        >
          <div
            ref={trapRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-dialog-title"
            className="bg-white w-full max-w-sm rounded-2xl p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 id="report-dialog-title" className="font-bold text-gray-900">Inhalt melden</h2>
              <button onClick={handleClose} aria-label="Dialog schließen" className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <fieldset>
              <legend className="text-sm font-medium text-gray-700 mb-2">Grund der Meldung</legend>
              <div className="space-y-2">
                {GRUENDE.map(g => (
                  <label key={g.value} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="report-grund"
                      value={g.value}
                      checked={grund === g.value}
                      onChange={() => setGrund(g.value)}
                      className="accent-primary-500"
                    />
                    <span className="text-sm text-gray-700">{g.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="report-beschreibung" className="text-sm font-medium text-gray-700 mb-1 block">
                Beschreibung <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <textarea
                id="report-beschreibung"
                value={beschreibung}
                onChange={e => setBeschreibung(e.target.value)}
                rows={3}
                placeholder="Weitere Details …"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-600"
              >
                Abbrechen
              </button>
              <button
                onClick={submit}
                disabled={!grund || loading}
                className={clsx(
                  'flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2',
                  'bg-red-500 text-white disabled:opacity-50'
                )}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                Melden
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
