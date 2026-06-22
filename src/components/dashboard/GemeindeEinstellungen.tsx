'use client'

import { toast } from 'sonner'
import { useState } from 'react'
import { Settings, Check, X, Loader2 } from 'lucide-react'

interface Props {
  gemeindeId: string
  initialEinwohner: number | null
  initialHaushalte: number | null
  initialRatsinformationUrl: string | null
  initialNotfallnummernUrl: string | null
  initialHomepageUrl: string | null
  initialMitteilungsblattUrl: string | null
  initialWarncellId: string | null
}

const DIENSTE = [
  { key: 'ratsinformation_url',  label: 'Ratsinformationssystem', placeholder: 'https://ris.gemeinde.de' },
  { key: 'notfallnummern_url',   label: 'Notfallnummern',         placeholder: 'https://...' },
  { key: 'homepage_url',         label: 'Homepage',               placeholder: 'https://www.gemeinde.de' },
  { key: 'mitteilungsblatt_url', label: 'Mitteilungsblatt',       placeholder: 'https://...' },
] as const

export default function GemeindeEinstellungen({
  gemeindeId,
  initialEinwohner,
  initialHaushalte,
  initialRatsinformationUrl,
  initialNotfallnummernUrl,
  initialHomepageUrl,
  initialMitteilungsblattUrl,
  initialWarncellId,
}: Props) {
  const [open, setOpen] = useState(false)
  const [einwohner, setEinwohner] = useState(String(initialEinwohner ?? ''))
  const [haushalte, setHaushalte] = useState(String(initialHaushalte ?? ''))
  const [warncellId, setWarncellId] = useState(initialWarncellId ?? '')
  const [urls, setUrls] = useState({
    ratsinformation_url:  initialRatsinformationUrl  ?? '',
    notfallnummern_url:   initialNotfallnummernUrl   ?? '',
    homepage_url:         initialHomepageUrl         ?? '',
    mitteilungsblatt_url: initialMitteilungsblattUrl ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setLoading(true)
    try {
      const res = await fetch('/api/gemeinde/aktualisieren', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gemeindeId,
          einwohner: einwohner ? parseInt(einwohner) : null,
          haushalte: haushalte ? parseInt(haushalte) : null,
          warncell_id: warncellId,
          ...urls,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Unbekannter Fehler')
      setSaved(true)
      setTimeout(() => { setSaved(false); setOpen(false) }, 1200)
    } catch (e: unknown) {
      toast.error('Fehler beim Speichern: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        <Settings className="w-3.5 h-3.5" />
        Gemeinde-Einstellungen
      </button>

      {open && (
        <div className="mt-3 bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          {/* Statistiken */}
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Einwohnerzahl</label>
              <input
                type="number"
                value={einwohner}
                onChange={e => setEinwohner(e.target.value)}
                placeholder="z.B. 7500"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Anzahl Haushalte</label>
              <input
                type="number"
                value={haushalte}
                onChange={e => setHaushalte(e.target.value)}
                placeholder="z.B. 3200"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Online-Dienste */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Online-Dienste</p>
            <div className="space-y-2">
              {DIENSTE.map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 block mb-1">{label}</label>
                  <input
                    type="url"
                    value={urls[key]}
                    onChange={e => setUrls(u => ({ ...u, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">Leer lassen = Kachel wird nicht angezeigt</p>
          </div>

          {/* DWD Warnmeldungen */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">DWD Warnmeldungen</p>
            <label className="text-xs text-gray-500 block mb-1">Warn-Cell-ID</label>
            <input
              type="text"
              value={warncellId}
              onChange={e => setWarncellId(e.target.value)}
              placeholder="z.B. 808115013"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-gray-400 mt-1.5">
              Numerische ID aus der Bright Sky API (z.B. über <code className="bg-gray-100 px-1 rounded">api.brightsky.dev/alerts?lat=…&lon=…</code>). Leer lassen = keine DWD-Warnungen.
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={loading || saved}
              className="flex items-center gap-1.5 bg-primary-500 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : null}
              {saved ? 'Gespeichert' : 'Speichern'}
            </button>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 p-2">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
