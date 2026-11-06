'use client'

import { useState } from 'react'
import { Bell, Mail, CheckCircle } from 'lucide-react'
import { clsx } from 'clsx'
import { toast } from 'sonner'
import { ZurueckButton } from '@/components/ui'
import { erstelleOptimistischenAbgleich } from '@/lib/optimistischerToggle'
import { ABFALL_TYP_CONFIG } from '@/lib/icsParser'
import type { AbfallTypSchluessel } from '@/lib/icsParser'
import { Trash2 } from 'lucide-react'
import { SAMMLUNG_ART_OPTIONEN, SAMMLUNG_ART_CONFIG, sammlungPraeferenzSchluessel } from '@/lib/abfallkalenderSammlung'

interface Props {
  gemeindeName: string
  verfuegbareTypen: string[]
  initialAusgewaehlt: string[]
  initialPush: boolean
  initialEmail: boolean
}

export default function AbfallEinstellungenClient({
  gemeindeName,
  verfuegbareTypen,
  initialAusgewaehlt,
  initialPush,
  initialEmail,
}: Props) {
  const [{ ausgewaehlt, push, email }, setPraeferenzen] = useState({
    ausgewaehlt: initialAusgewaehlt,
    push: initialPush,
    email: initialEmail,
  })
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  const [abgleich] = useState(() => erstelleOptimistischenAbgleich({
    start: { ausgewaehlt: initialAusgewaehlt, push: initialPush, email: initialEmail },
    senden: async ziel => {
      const res = await fetch('/api/abfallkalender/praeferenzen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // keepalive: Die Änderung soll auch ankommen, wenn die App direkt danach geschlossen wird
        keepalive: true,
        body: JSON.stringify({
          ausgewaehlteTypen: ziel.ausgewaehlt,
          pushAktiviert: ziel.push,
          emailAktiviert: ziel.email,
          benachrichtigungUhrzeit: '18:00',
        }),
      })
      if (!res.ok) throw new Error()
    },
    onAenderung: setPraeferenzen,
    onBestaetigt: () => setStatus('saved'),
    onFehler: () => {
      setStatus('idle')
      toast.error('Speichern fehlgeschlagen. Die Änderung wurde zurückgenommen.')
    },
  }))

  function aendern(aenderung: Partial<ReturnType<typeof abgleich.aktuell>>) {
    setStatus('saving')
    abgleich.setzen({ ...abgleich.aktuell(), ...aenderung })
  }

  function toggleTyp(typ: string) {
    const aktuell = abgleich.aktuell().ausgewaehlt
    aendern({ ausgewaehlt: aktuell.includes(typ) ? aktuell.filter(t => t !== typ) : [...aktuell, typ] })
  }

  return (
    <div className="min-h-screen bg-[#F4F6F9] pb-28">
      {/* Header */}
      {/* pt-safe-header statt pt-14 wegen Notch/Dynamic Island */}
      <div className="bg-primary-500 px-4 pt-safe-header pb-5">
        <div className="flex items-center gap-2 mb-1">
          <ZurueckButton fallback="/abfallkalender" variant="hell" label={false} />
          <p className="text-primary-200 text-xs font-bold tracking-[0.2em] uppercase">
            {gemeindeName}
          </p>
        </div>
        <h1 className="text-white font-black text-2xl">Abfallkalender · Einstellungen</h1>
      </div>

      <div className="px-4 py-5 space-y-5">

        {/* Abfallarten auswählen */}
        <section className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-black text-gray-900 text-sm uppercase tracking-wide mb-4">
            Abfallarten
          </h2>
          {verfuegbareTypen.length === 0 && (
            <p className="text-sm text-gray-400">
              Noch keine Abfallarten verfügbar. Der Admin muss zuerst eine ICS-Datei importieren.
            </p>
          )}
          <div className="space-y-2">
            {verfuegbareTypen.map(typ => {
              const config = ABFALL_TYP_CONFIG[typ as AbfallTypSchluessel]
              if (!config) return null
              const aktiv = ausgewaehlt.includes(typ)

              return (
                <button
                  key={typ}
                  onClick={() => toggleTyp(typ)}
                  aria-pressed={aktiv}
                  className={clsx(
                    'w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left',
                    aktiv ? 'bg-gray-50 ring-1 ring-gray-200' : 'bg-gray-50/50 opacity-60',
                  )}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: config.bgFarbe }}
                  >
                    <Trash2 className="w-4 h-4" style={{ color: config.farbe }} strokeWidth={1.5} />
                  </div>
                  <span className="flex-1 font-semibold text-gray-800 text-sm">{config.label}</span>
                  <div
                    className={clsx(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                      aktiv ? 'border-primary-500 bg-primary-500' : 'border-gray-300',
                    )}
                  >
                    {aktiv && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* Sammlungen auswählen */}
        <section className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-black text-gray-900 text-sm uppercase tracking-wide mb-4">
            Sammlungen
          </h2>
          <div className="space-y-2">
            {SAMMLUNG_ART_OPTIONEN.map(option => {
              const schluessel = sammlungPraeferenzSchluessel(option.value)
              const config = SAMMLUNG_ART_CONFIG[option.value]
              const aktiv = ausgewaehlt.includes(schluessel)

              return (
                <button
                  key={schluessel}
                  onClick={() => toggleTyp(schluessel)}
                  aria-pressed={aktiv}
                  className={clsx(
                    'w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left',
                    aktiv ? 'bg-gray-50 ring-1 ring-gray-200' : 'bg-gray-50/50 opacity-60',
                  )}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: config.bgFarbe }}
                  >
                    <Trash2 className="w-4 h-4" style={{ color: config.farbe }} strokeWidth={1.5} />
                  </div>
                  <span className="flex-1 font-semibold text-gray-800 text-sm">{config.label}</span>
                  <div
                    className={clsx(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                      aktiv ? 'border-primary-500 bg-primary-500' : 'border-gray-300',
                    )}
                  >
                    {aktiv && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* Benachrichtigungen */}
        <section className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <h2 className="font-black text-gray-900 text-sm uppercase tracking-wide">
            Benachrichtigungen
          </h2>

          {/* Push */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4 text-primary-600" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-800 text-sm">Push-Benachrichtigung</p>
              <p className="text-xs text-gray-400">Am Vortag der Abfuhr</p>
            </div>
            <button
              onClick={() => aendern({ push: !abgleich.aktuell().push })}
              role="switch"
              aria-checked={push}
              aria-label="Push-Benachrichtigung"
              className={clsx(
                'relative w-11 h-6 rounded-full transition-colors shrink-0 overflow-hidden',
                push ? 'bg-primary-500' : 'bg-gray-300',
              )}
            >
              <span
                className={clsx(
                  'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                  push ? 'translate-x-[20px]' : 'translate-x-0',
                )}
              />
            </button>
          </div>

          {/* E-Mail */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4 text-blue-600" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-800 text-sm">E-Mail</p>
              <p className="text-xs text-gray-400">Am Vortag der Abfuhr (Kontakt-E-Mail)</p>
            </div>
            <button
              onClick={() => aendern({ email: !abgleich.aktuell().email })}
              role="switch"
              aria-checked={email}
              aria-label="E-Mail-Benachrichtigung"
              className={clsx(
                'relative w-11 h-6 rounded-full transition-colors shrink-0 overflow-hidden',
                email ? 'bg-primary-500' : 'bg-gray-300',
              )}
            >
              <span
                className={clsx(
                  'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                  email ? 'translate-x-[20px]' : 'translate-x-0',
                )}
              />
            </button>
          </div>

          {(push || email) && (
            <p className="text-xs text-gray-400 pl-1">
              Die Erinnerung kommt am Vortag der Abfuhr um <strong>18:00 Uhr</strong>.
            </p>
          )}
        </section>

        <p role="status" className="text-xs text-gray-600 text-center">
          {status === 'saving' ? 'Wird gespeichert …' : status === 'saved' ? 'Gespeichert ✓' : 'Änderungen werden automatisch gespeichert.'}
        </p>
      </div>
    </div>
  )
}
