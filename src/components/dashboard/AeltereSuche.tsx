'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Search, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import type { SuchTyp } from '@/lib/dashboardSuche'

interface Props<T> {
  typ: SuchTyp
  label: string
  children: (treffer: T[]) => React.ReactNode
}

/**
 * Aufklappbare Suche am Fuss einer Dashboard-Liste.
 *
 * Die Listen zeigen nur ein Arbeitsset. Aelteres wird selten gebraucht und
 * deshalb nicht mitgeladen, sondern hier serverseitig gesucht. Die
 * Trefferdarstellung liefert die aufrufende Section per children-Funktion,
 * damit diese Komponente nichts ueber die einzelnen Datentypen wissen muss.
 */
export default function AeltereSuche<T>({ typ, label, children }: Props<T>) {
  const [offen, setOffen] = useState(false)
  const [suchbegriff, setSuchbegriff] = useState('')
  const [treffer, setTreffer] = useState<T[] | null>(null)
  const [mehrVorhanden, setMehrVorhanden] = useState(false)
  const [laedt, setLaedt] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  const feldId = useId()
  const feldRef = useRef<HTMLInputElement>(null)

  // Ab zwei Zeichen wird gesucht. Als abgeleiteter Wert statt als State,
  // damit sich der Ungueltig-Fall ohne synchrones setState im Effekt (siehe
  // unten) einfach durch Nicht-Rendern des Trefferbereichs ausdruecken laesst.
  const begriff = suchbegriff.trim()
  const gueltig = offen && begriff.length >= 2

  useEffect(() => {
    if (offen) feldRef.current?.focus()
  }, [offen])

  useEffect(() => {
    // Ungueltige Eingaben brauchen keinen Reset per setState: die JSX-Ausgabe
    // unten blendet den Trefferbereich ohnehin aus, solange !gueltig gilt.
    if (!gueltig) return

    const abbruch = new AbortController()
    const zeit = setTimeout(async () => {
      setLaedt(true)
      setFehler(null)
      try {
        const res = await fetch(
          `/api/verwaltung/suche?typ=${typ}&q=${encodeURIComponent(begriff)}`,
          { signal: abbruch.signal },
        )
        if (!res.ok) throw new Error()
        const daten = await res.json()
        setTreffer(daten.treffer as T[])
        setMehrVorhanden(Boolean(daten.mehrVorhanden))
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        setFehler('Suche fehlgeschlagen. Bitte erneut versuchen.')
        setTreffer(null)
      } finally {
        setLaedt(false)
      }
    }, 300)

    return () => { clearTimeout(zeit); abbruch.abort() }
  }, [gueltig, begriff, typ])

  return (
    <div className="border-t border-gray-100">
      <button
        onClick={() => setOffen(o => !o)}
        aria-expanded={offen}
        className="w-full flex items-center gap-2 px-5 py-3 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
      >
        <Search className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left">{label}</span>
        {offen
          ? <ChevronUp className="w-4 h-4 shrink-0" aria-hidden="true" />
          : <ChevronDown className="w-4 h-4 shrink-0" aria-hidden="true" />}
      </button>

      {offen && (
        <div className="px-5 pb-4 space-y-3">
          <div>
            <label htmlFor={feldId} className="block text-xs font-semibold text-gray-600 mb-1">
              Suchbegriff
            </label>
            <input
              id={feldId}
              ref={feldRef}
              type="search"
              value={suchbegriff}
              onChange={e => setSuchbegriff(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>

          {gueltig && fehler && (
            <p role="alert" className="text-sm text-red-600">{fehler}</p>
          )}

          <div aria-live="polite" className="text-xs text-gray-500">
            {gueltig && laedt && (
              <span className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                Suche läuft …
              </span>
            )}
            {gueltig && !laedt && treffer && treffer.length === 0 && 'Keine Treffer'}
            {gueltig && !laedt && treffer && treffer.length > 0 && (
              mehrVorhanden
                ? `Mehr als ${treffer.length} Treffer — bitte Suche eingrenzen`
                : `${treffer.length} Treffer`
            )}
          </div>

          {gueltig && treffer && treffer.length > 0 && children(treffer)}
        </div>
      )}
    </div>
  )
}
