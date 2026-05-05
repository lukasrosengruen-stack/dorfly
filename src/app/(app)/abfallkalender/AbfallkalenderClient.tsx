'use client'

import { useState, useMemo } from 'react'
import { format, isToday, isTomorrow, parseISO, addDays, isWithinInterval } from 'date-fns'
import { de } from 'date-fns/locale'
import { ChevronLeft, Settings, Trash2, User } from 'lucide-react'
import { clsx } from 'clsx'
import Link from 'next/link'
import { ABFALL_TYP_CONFIG } from '@/lib/icsParser'
import type { AbfallTypSchluessel } from '@/lib/icsParser'

type Zeitraum = 7 | 30 | 90

interface Termin {
  id: string
  typ: string
  datum: string
}

interface Props {
  termine: Termin[]
  ausgewaehlteTypen: string[]
  verfuegbareTypen: string[]
  gemeindeName: string
  hatPraeferenzen: boolean
}

export default function AbfallkalenderClient({
  termine,
  ausgewaehlteTypen,
  gemeindeName,
  hatPraeferenzen,
}: Props) {
  const [zeitraum, setZeitraum] = useState<Zeitraum>(30)

  const gefiltert = useMemo(() => {
    const heute = new Date()
    const ende = addDays(heute, zeitraum)

    return termine.filter(t => {
      if (!ausgewaehlteTypen.includes(t.typ)) return false
      const datum = parseISO(t.datum)
      return isWithinInterval(datum, { start: heute, end: ende })
    })
  }, [termine, ausgewaehlteTypen, zeitraum])

  // Gruppierung nach Datum
  const grouped = useMemo(() => {
    const map = new Map<string, Termin[]>()
    for (const t of gefiltert) {
      const existing = map.get(t.datum) ?? []
      map.set(t.datum, [...existing, t])
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [gefiltert])

  return (
    <div className="min-h-screen bg-[#F4F6F9] pb-28">
      {/* Header */}
      <div className="bg-primary-500 px-4 pt-14 pb-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <Link href="/home" className="text-white/80 hover:text-white">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <p className="text-primary-200 text-xs font-bold tracking-[0.2em] uppercase">
              {gemeindeName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/abfallkalender/einstellungen"
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0"
              title="Einstellungen"
            >
              <Settings className="w-4 h-4 text-white" />
            </Link>
            <Link href="/profil" className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-white" />
            </Link>
          </div>
        </div>
        <h1 className="text-white font-black text-2xl">Abfallkalender</h1>
        {!hatPraeferenzen && (
          <p className="text-primary-200 text-xs mt-1">
            Abfallarten in den{' '}
            <Link href="/abfallkalender/einstellungen" className="underline">
              Einstellungen
            </Link>{' '}
            personalisieren
          </p>
        )}
      </div>

      {/* Zeitraum-Filter */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex gap-2 overflow-x-auto scrollbar-none sticky top-0 z-10">
        {([7, 30, 90] as Zeitraum[]).map(tage => (
          <button
            key={tage}
            onClick={() => setZeitraum(tage)}
            className={clsx(
              'shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-colors',
              zeitraum === tage
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {tage} Tage
          </button>
        ))}
      </div>

      {/* Inhalt */}
      <div className="px-4 py-5 space-y-6">
        {grouped.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
            <Trash2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-black text-gray-400 uppercase tracking-wide text-sm">
              Keine Abfuhrtermine
            </p>
            <p className="text-gray-400 text-xs mt-1">
              im gewählten Zeitraum oder keine Abfallart ausgewählt
            </p>
            <Link
              href="/abfallkalender/einstellungen"
              className="inline-block mt-4 text-xs font-bold text-primary-600 underline"
            >
              Abfallarten auswählen
            </Link>
          </div>
        )}

        {grouped.map(([dateKey, tagesTermine]) => {
          const datum = parseISO(dateKey)
          const istHeute = isToday(datum)
          const istMorgen = isTomorrow(datum)

          return (
            <div key={dateKey}>
              {/* Datums-Header */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={clsx(
                    'w-12 h-12 rounded-2xl flex flex-col items-center justify-center shrink-0',
                    istHeute ? 'bg-primary-500' : 'bg-white shadow-sm',
                  )}
                >
                  <span
                    className={clsx(
                      'text-xs font-bold uppercase leading-none',
                      istHeute ? 'text-primary-200' : 'text-gray-400',
                    )}
                  >
                    {format(datum, 'EEE', { locale: de })}
                  </span>
                  <span
                    className={clsx(
                      'text-xl font-black leading-tight',
                      istHeute ? 'text-white' : 'text-gray-900',
                    )}
                  >
                    {format(datum, 'd')}
                  </span>
                </div>
                <div>
                  <p
                    className={clsx(
                      'font-black text-sm',
                      istHeute ? 'text-primary-600' : istMorgen ? 'text-amber-600' : 'text-gray-700',
                    )}
                  >
                    {istHeute ? 'Heute' : istMorgen ? 'Morgen' : format(datum, 'EEEE', { locale: de })}
                  </p>
                  <p className="text-xs text-gray-400">
                    {format(datum, 'd. MMMM yyyy', { locale: de })}
                  </p>
                </div>
              </div>

              {/* Abfuhr-Karten für dieses Datum */}
              <div className="space-y-2 ml-1">
                {tagesTermine.map(termin => {
                  const config = ABFALL_TYP_CONFIG[termin.typ as AbfallTypSchluessel]
                  if (!config) return null

                  return (
                    <div
                      key={termin.id}
                      className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3"
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: config.bgFarbe }}
                      >
                        <Trash2 className="w-5 h-5" style={{ color: config.farbe }} strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm leading-snug">
                          {config.label}
                        </p>
                        {(istHeute || istMorgen) && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Tonne bis 06:00 Uhr bereitstellen
                          </p>
                        )}
                      </div>
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: config.farbe }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
