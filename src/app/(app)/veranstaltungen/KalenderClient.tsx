'use client'

import { useState, useMemo } from 'react'
import { format, isToday, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addMonths, isWithinInterval, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { Calendar, Clock, MapPin, User } from 'lucide-react'
import { clsx } from 'clsx'
import Link from 'next/link'
import { AufklappbarerText, PostBild, ZurueckButton } from '@/components/ui'
import { renderRichText } from '@/lib/richText'

type Zeitraum = 'heute' | 'woche' | 'monat' | 'naechster_monat'

const ZEITRAUM_LABELS: Record<Zeitraum, string> = {
  heute:          'Heute',
  woche:          'Diese Woche',
  monat:          'Dieser Monat',
  naechster_monat: 'Nächster Monat',
}

interface Veranstaltung {
  id: string
  titel: string
  inhalt: string
  bild_url: string | null
  veranstaltung_datum: string
  veranstaltung_ort?: string | null
  channel: string
  tag: string | null
  profiles?: { display_name?: string | null; verein_name?: string | null } | null
}

interface Props {
  veranstaltungen: Veranstaltung[]
  gemeindeName: string
}

export default function KalenderClient({ veranstaltungen, gemeindeName }: Props) {
  const [aktiv, setAktiv] = useState<Zeitraum>('woche')

  const gefiltert = useMemo(() => {
    const now = new Date()
    let interval: { start: Date; end: Date }

    switch (aktiv) {
      case 'heute':
        interval = { start: new Date(now.getFullYear(), now.getMonth(), now.getDate()), end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59) }
        break
      case 'woche':
        interval = { start: startOfWeek(now, { locale: de }), end: endOfWeek(now, { locale: de }) }
        break
      case 'monat':
        interval = { start: startOfMonth(now), end: endOfMonth(now) }
        break
      case 'naechster_monat': {
        const next = addMonths(now, 1)
        interval = { start: startOfMonth(next), end: endOfMonth(next) }
        break
      }
    }

    return veranstaltungen.filter(v => {
      const datum = parseISO(v.veranstaltung_datum)
      return isWithinInterval(datum, interval)
    })
  }, [veranstaltungen, aktiv])

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, Veranstaltung[]>()
    for (const v of gefiltert) {
      const key = format(parseISO(v.veranstaltung_datum), 'yyyy-MM-dd')
      const existing = map.get(key) ?? []
      map.set(key, [...existing, v])
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [gefiltert])

  return (
    <div className="min-h-screen bg-[#F4F6F9] pb-28">
      {/* Header – pt-safe-header statt pt-14: sonst liegt der Gemeindename
          unter der Notch. */}
      <div className="bg-primary-500 px-4 pt-safe-header pb-5">
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ZurueckButton fallback="/home" variant="hell" label={false} />
            <p className="text-primary-200 text-xs font-bold tracking-[0.2em] uppercase">{gemeindeName}</p>
          </div>
          <Link
            href="/profil"
            aria-label="Zum Profil"
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0"
          >
            <User className="w-4 h-4 text-white" aria-hidden="true" />
          </Link>
        </div>
        <h1 className="text-white font-black text-2xl">Veranstaltungen</h1>
      </div>

      {/* Filter */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex gap-2 overflow-x-auto scrollbar-none sticky top-0 z-10">
        {(Object.entries(ZEITRAUM_LABELS) as [Zeitraum, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setAktiv(key)}
            className={clsx(
              'shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-colors',
              aktiv === key
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-4 py-5 space-y-6">
        {grouped.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
            <Calendar className="w-10 h-10 text-gray-400 mx-auto mb-3" aria-hidden="true" />
            <p className="font-black text-gray-600 uppercase tracking-wide text-sm">Keine Veranstaltungen</p>
            <p className="text-gray-600 text-xs mt-1">für diesen Zeitraum</p>
          </div>
        )}

        {grouped.map(([dateKey, events]) => {
          const datum = parseISO(dateKey)
          const istHeute = isToday(datum)

          return (
            <div key={dateKey}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-3">
                <div className={clsx(
                  'w-12 h-12 rounded-2xl flex flex-col items-center justify-center shrink-0',
                  istHeute ? 'bg-primary-500' : 'bg-white shadow-sm'
                )}>
                  <span className={clsx('text-xs font-bold uppercase leading-none', istHeute ? 'text-primary-200' : 'text-gray-600')}>
                    {format(datum, 'EEE', { locale: de })}
                  </span>
                  <span className={clsx('text-xl font-black leading-tight', istHeute ? 'text-white' : 'text-gray-900')}>
                    {format(datum, 'd')}
                  </span>
                </div>
                <div>
                  <p className={clsx('font-black text-sm', istHeute ? 'text-primary-600' : 'text-gray-700')}>
                    {istHeute ? 'Heute' : format(datum, 'EEEE', { locale: de })}
                  </p>
                  <p className="text-xs text-gray-600">{format(datum, 'd. MMMM yyyy', { locale: de })}</p>
                </div>
              </div>

              {/* Events for this date */}
              <div className="space-y-3 ml-1">
                {events.map(v => {
                  const uhrzeit = format(parseISO(v.veranstaltung_datum), 'HH:mm')
                  const autor = v.profiles
                  const autorName = autor?.verein_name ?? autor?.display_name ?? gemeindeName

                  return (
                    <div key={v.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                      {/* Gleiche Bilddarstellung wie im Newsfeed: natürliches
                          Seitenverhältnis im Korridor 1.91:1 bis 4:5 statt
                          fester Höhe. Alt-Text ist wie dort der Titel. */}
                      <PostBild bilder={v.bild_url ? [v.bild_url] : []} alt={v.titel} />
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="flex items-center gap-1 text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full">
                            <Clock className="w-3 h-3" aria-hidden="true" />
                            {uhrzeit} Uhr
                          </span>
                          {v.veranstaltung_ort && (
                            <span className="flex items-center gap-1 text-xs font-bold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">
                              <MapPin className="w-3 h-3" aria-hidden="true" />
                              {v.veranstaltung_ort}
                            </span>
                          )}
                          <span className="text-xs text-gray-500 ml-auto truncate">{autorName}</span>
                        </div>
                        <h3 className="font-black text-gray-900 text-base leading-snug uppercase tracking-wide">
                          {v.titel}
                        </h3>
                        {/* Der volle Text steht schon in der Query – gekürzt
                            wurde bisher nur per CSS, ohne Ausweg. Jetzt
                            derselbe Aufklapper wie im Newsfeed. */}
                        <div className="mt-1.5">
                          <AufklappbarerText className="text-gray-600 text-sm leading-relaxed">
                            {renderRichText(v.inhalt)}
                          </AufklappbarerText>
                        </div>
                      </div>
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
