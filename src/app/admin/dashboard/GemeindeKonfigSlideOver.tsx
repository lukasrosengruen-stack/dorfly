'use client'

import { useState } from 'react'
import { X, Settings } from 'lucide-react'
import { toast } from 'sonner'
import type { GemeindeFeatures } from '@/lib/features'

const FEATURE_LABELS: { key: keyof Omit<GemeindeFeatures, 'buergermeisterLabel'>; label: string }[] = [
  { key: 'abfallkalender', label: 'Abfallkalender' },
  { key: 'umfragen',       label: 'Umfragen' },
  { key: 'gemeinderat',    label: 'Gemeinderat' },
  { key: 'gewerbe',        label: 'Gewerbe & Lokale Angebote' },
  { key: 'vereine',        label: 'Vereine' },
  { key: 'marktplatz',     label: 'Marktplatz' },
  { key: 'feedback',       label: 'Feedback' },
]

interface Props {
  gemeindeId: string
  gemeindeName: string
  initialFeatures: GemeindeFeatures
  open: boolean
  onClose: () => void
}

export default function GemeindeKonfigSlideOver({
  gemeindeId,
  gemeindeName,
  initialFeatures,
  open,
  onClose,
}: Props) {
  const [features, setFeatures] = useState<GemeindeFeatures>(initialFeatures)
  const [saving, setSaving] = useState<string | null>(null)

  async function updateFeature(patch: Partial<GemeindeFeatures>) {
    const key = Object.keys(patch)[0]
    setSaving(key)
    const optimistic = { ...features, ...patch }
    setFeatures(optimistic)

    try {
      const res = await fetch(`/api/admin/gemeinden/${gemeindeId}/features`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setFeatures(data.features as GemeindeFeatures)
    } catch (e) {
      setFeatures(features) // rollback
      toast.error('Fehler beim Speichern: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSaving(null)
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Konfiguration: ${gemeindeName}`}
        className="fixed right-0 top-0 h-full w-80 bg-white shadow-xl z-50 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-gray-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-gray-900">Konfiguration</p>
              <p className="text-xs text-gray-400 truncate max-w-[180px]">{gemeindeName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Konfiguration schließen"
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

          {/* Feature Toggles */}
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Optionale Features
            </p>
            <div className="space-y-3">
              {FEATURE_LABELS.map(({ key, label }) => {
                const aktiv = features[key] === true
                const isSaving = saving === key
                return (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{label}</span>
                    <button
                      role="switch"
                      aria-checked={aktiv}
                      aria-label={`${label} ${aktiv ? 'deaktivieren' : 'aktivieren'}`}
                      disabled={isSaving}
                      onClick={() => updateFeature({ [key]: !aktiv })}
                      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 ${
                        aktiv ? 'bg-indigo-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
                          aktiv ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Bürgermeister Label */}
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Einstellungen
            </p>
            <div>
              <p className="text-sm text-gray-700 mb-2">„Frag den…"-Bezeichnung</p>
              <div className="flex flex-col gap-2">
                {(['buergermeister', 'verwaltung'] as const).map((option) => {
                  const checked = (features.buergermeisterLabel ?? 'buergermeister') === option
                  return (
                    <label key={option} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="buergermeisterLabel"
                        value={option}
                        checked={checked}
                        onChange={() => updateFeature({ buergermeisterLabel: option })}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700">
                        {option === 'buergermeister' ? 'Frag den Bürgermeister' : 'Frag die Verwaltung'}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          </section>

        </div>
      </div>
    </>
  )
}
