'use client'

import { useRef, useState } from 'react'
import { Upload, CheckCircle, AlertCircle, Trash2, Calendar } from 'lucide-react'
import { ABFALL_TYP_CONFIG } from '@/lib/icsParser'
import type { AbfallTypSchluessel } from '@/lib/icsParser'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

interface EinstellungData {
  verfuegbare_typen: string[]
  importiert_am: string | null
  importiert_von: string | null
}

interface Props {
  einstellungen: EinstellungData | null
}

type UploadStatus =
  | { state: 'idle' }
  | { state: 'uploading' }
  | { state: 'success'; importiert: number; erkannteTypen: string[]; unbekannteTypen: string[] }
  | { state: 'error'; message: string }

export default function AbfallkalenderSection({ einstellungen: initialEinstellungen }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<UploadStatus>({ state: 'idle' })
  const [einstellungen, setEinstellungen] = useState(initialEinstellungen)

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.ics')) {
      setStatus({ state: 'error', message: 'Nur .ics-Dateien werden unterstützt.' })
      return
    }

    setStatus({ state: 'uploading' })

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/abfallkalender/import', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()

      if (!res.ok) {
        setStatus({ state: 'error', message: json.error ?? 'Unbekannter Fehler' })
        return
      }

      setStatus({
        state: 'success',
        importiert: json.importiert,
        erkannteTypen: json.erkannteTypen ?? [],
        unbekannteTypen: json.unbekannteTypen ?? [],
      })

      // Einstellungen lokal aktualisieren
      setEinstellungen(prev => ({
        verfuegbare_typen: prev?.verfuegbare_typen ?? [],
        importiert_am: new Date().toISOString(),
        importiert_von: prev?.importiert_von ?? null,
      }))
    } catch {
      setStatus({ state: 'error', message: 'Netzwerkfehler beim Upload.' })
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const verfuegbareTypen = einstellungen?.verfuegbare_typen ?? []

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Trash2 className="w-4 h-4 text-green-600" />
        <h2 className="font-bold text-gray-900">Abfallkalender verwalten</h2>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-5 space-y-5">

        {/* Letzter Import */}
        {einstellungen?.importiert_am && (
          <div className="flex items-center gap-3 text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-3">
            <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
            <span>
              Zuletzt importiert am{' '}
              <strong>
                {format(new Date(einstellungen.importiert_am), 'd. MMMM yyyy, HH:mm', { locale: de })}
              </strong>
              {einstellungen.importiert_von && ` von ${einstellungen.importiert_von}`}
            </span>
          </div>
        )}

        {/* Upload-Bereich */}
        <div
          className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-colors"
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
        >
          <Upload className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-700 text-sm">ICS-Datei hochladen</p>
          <p className="text-xs text-gray-400 mt-1">
            Klicken oder Datei hier ablegen · Bestehende Termine werden ersetzt
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".ics"
            className="hidden"
            onChange={handleInputChange}
          />
        </div>

        {/* Status-Feedback */}
        {status.state === 'uploading' && (
          <div className="flex items-center gap-2 text-sm text-gray-500 animate-pulse">
            <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
            Datei wird verarbeitet…
          </div>
        )}

        {status.state === 'success' && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-sm text-green-700 bg-green-50 rounded-xl px-4 py-3">
              <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">
                  {status.importiert} Termine erfolgreich importiert
                </p>
                {status.unbekannteTypen.length > 0 && (
                  <p className="text-green-600 text-xs mt-0.5">
                    Nicht erkannt: {status.unbekannteTypen.join(', ')}
                  </p>
                )}
              </div>
            </div>

            {status.erkannteTypen.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Erkannte Abfallarten
                </p>
                <div className="flex flex-wrap gap-2">
                  {status.erkannteTypen.map(label => (
                    <span
                      key={label}
                      className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-700"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {status.state === 'error' && (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <p>{status.message}</p>
          </div>
        )}

        {/* Verfügbare Typen dieser Gemeinde */}
        {verfuegbareTypen.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Verfügbare Abfallarten
            </p>
            <div className="flex flex-wrap gap-2">
              {verfuegbareTypen.map(typ => {
                const config = ABFALL_TYP_CONFIG[typ as AbfallTypSchluessel]
                if (!config) return null
                return (
                  <span
                    key={typ}
                    className="text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{ background: config.bgFarbe, color: config.farbe }}
                  >
                    {config.label}
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
