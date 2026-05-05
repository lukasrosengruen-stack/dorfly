'use client'

import { useState } from 'react'
import { ChevronLeft, Bell, Mail, Clock, CheckCircle } from 'lucide-react'
import { clsx } from 'clsx'
import Link from 'next/link'
import { ABFALL_TYP_CONFIG } from '@/lib/icsParser'
import type { AbfallTypSchluessel } from '@/lib/icsParser'
import { Trash2 } from 'lucide-react'

interface Props {
  gemeindeName: string
  verfuegbareTypen: string[]
  initialAusgewaehlt: string[]
  initialPush: boolean
  initialEmail: boolean
  initialUhrzeit: string
}

export default function AbfallEinstellungenClient({
  gemeindeName,
  verfuegbareTypen,
  initialAusgewaehlt,
  initialPush,
  initialEmail,
  initialUhrzeit,
}: Props) {
  const [ausgewaehlt, setAusgewaehlt] = useState<string[]>(initialAusgewaehlt)
  const [push, setPush] = useState(initialPush)
  const [email, setEmail] = useState(initialEmail)
  const [uhrzeit, setUhrzeit] = useState(initialUhrzeit)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  function toggleTyp(typ: string) {
    setAusgewaehlt(prev =>
      prev.includes(typ) ? prev.filter(t => t !== typ) : [...prev, typ],
    )
  }

  async function handleSpeichern() {
    setStatus('saving')
    try {
      const res = await fetch('/api/abfallkalender/praeferenzen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ausgewaehlteTypen: ausgewaehlt,
          pushAktiviert: push,
          emailAktiviert: email,
          benachrichtigungUhrzeit: uhrzeit,
        }),
      })

      if (!res.ok) {
        setStatus('error')
        return
      }

      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2500)
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F6F9] pb-28">
      {/* Header */}
      <div className="bg-primary-500 px-4 pt-14 pb-5">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/abfallkalender" className="text-white/80 hover:text-white">
            <ChevronLeft className="w-5 h-5" />
          </Link>
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
              onClick={() => setPush(p => !p)}
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
              onClick={() => setEmail(e => !e)}
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

          {/* Uhrzeit */}
          {(push || email) && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-amber-600" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800 text-sm">Uhrzeit</p>
                <p className="text-xs text-gray-400">Wann soll die Erinnerung kommen?</p>
              </div>
              <input
                type="time"
                value={uhrzeit}
                onChange={e => setUhrzeit(e.target.value)}
                className="text-sm font-semibold text-gray-800 bg-gray-100 rounded-lg px-3 py-1.5 border-0 outline-none"
              />
            </div>
          )}
        </section>

        {/* Speichern */}
        <button
          onClick={handleSpeichern}
          disabled={status === 'saving'}
          className={clsx(
            'w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wide transition-colors',
            status === 'saved'
              ? 'bg-green-500 text-white'
              : status === 'error'
                ? 'bg-red-500 text-white'
                : 'bg-primary-500 text-white active:bg-primary-600 disabled:opacity-60',
          )}
        >
          {status === 'saving' ? 'Wird gespeichert…' : status === 'saved' ? 'Gespeichert ✓' : status === 'error' ? 'Fehler – erneut versuchen' : 'Einstellungen speichern'}
        </button>
      </div>
    </div>
  )
}
