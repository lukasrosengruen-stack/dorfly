'use client'

/**
 * AufklappbarerText – gekuerzter Fliesstext mit "Mehr lesen" / "Weniger anzeigen".
 *
 * Gemeinsame Umsetzung fuer Newsfeed und Veranstaltungen. Gekuerzt wird rein
 * per CSS (line-clamp), der volle Text steht immer im DOM — nichts muss
 * nachgeladen werden, und Screenreader, Suche im Browser und Kopieren finden
 * ihn auch im eingeklappten Zustand.
 *
 * Bewusst getrennt: der Text steht NICHT im Button. Der Fliesstext enthaelt
 * ueber renderRichText Links; ein Link in einem Button ist verschachtelte
 * Interaktivitaet und fuer Tastatur- und Screenreader-Bedienung kaputt.
 *
 * Der Umschalter erscheint nur, wenn der Text tatsaechlich laenger ist als das
 * Zeilenlimit — gemessen an Zeilenhoehe mal Zeilenzahl, was in beiden
 * Zustaenden funktioniert (scrollHeight meldet auch bei overflow:hidden die
 * volle Inhaltshoehe).
 */

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'

// line-clamp-Klassen muessen als ganze Literale dastehen, sonst findet sie
// Tailwind beim Scannen nicht.
const CLAMP_KLASSEN: Record<number, string> = {
  2: 'line-clamp-2',
  3: 'line-clamp-3',
  4: 'line-clamp-4',
}

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

export interface AufklappbarerTextProps {
  /** Gerenderter Text, z. B. das Ergebnis von renderRichText */
  children: React.ReactNode
  /** Zeilen im eingeklappten Zustand */
  zeilen?: 2 | 3 | 4
  /** Kontrollierter Zustand. Weglassen = die Komponente verwaltet ihn selbst. */
  expanded?: boolean
  /** Nur zusammen mit expanded */
  onToggle?: () => void
  /** Klassen des Textabsatzes */
  className?: string
}

export function AufklappbarerText({
  children,
  zeilen = 3,
  expanded,
  onToggle,
  className,
}: AufklappbarerTextProps) {
  const kontrolliert = expanded !== undefined
  const [eigenerZustand, setEigenerZustand] = useState(false)
  const offen = kontrolliert ? expanded : eigenerZustand

  const [abschneidbar, setAbschneidbar] = useState(false)
  const absatzRef = useRef<HTMLParagraphElement>(null)
  const textId = useId()

  const messen = useCallback(() => {
    const el = absatzRef.current
    if (!el) return
    const stil = window.getComputedStyle(el)
    const gemesseneZeilenhoehe = parseFloat(stil.lineHeight)
    // 'normal' laesst sich nicht parsen – dann naehern wir ueber die Schriftgroesse.
    const zeilenhoehe = Number.isFinite(gemesseneZeilenhoehe)
      ? gemesseneZeilenhoehe
      : parseFloat(stil.fontSize) * 1.5
    setAbschneidbar(el.scrollHeight > zeilenhoehe * zeilen + 1)
  }, [zeilen])

  useIsomorphicLayoutEffect(() => {
    messen()
    const el = absatzRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    // Breitenaenderung (Drehen des Geraets) und spaet geladene Schriften
    // veraendern den Umbruch und damit die Antwort auf die Frage.
    const beobachter = new ResizeObserver(messen)
    beobachter.observe(el)
    return () => beobachter.disconnect()
  }, [messen, children])

  function umschalten() {
    if (kontrolliert) onToggle?.()
    else setEigenerZustand(v => !v)
  }

  return (
    <div>
      <p
        id={textId}
        ref={absatzRef}
        className={clsx(
          'whitespace-pre-wrap',
          !offen && CLAMP_KLASSEN[zeilen],
          className,
        )}
      >
        {children}
      </p>

      {abschneidbar && (
        <button
          type="button"
          onClick={umschalten}
          aria-expanded={offen}
          aria-controls={textId}
          className="tap-transparent -mx-1 mt-0.5 inline-flex min-h-8 items-center rounded-lg px-1 text-xs font-semibold text-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-400"
        >
          {offen ? 'Weniger anzeigen' : 'Mehr lesen'}
        </button>
      )}
    </div>
  )
}
