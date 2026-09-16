'use client'

/**
 * ZurueckButton – einheitlicher Ausweg aus jeder Unterseite.
 *
 * Verhalten kommt aus useAppBack: router.back() bei vorhandener In-App-History,
 * sonst der Fallback. Ein Client-Baustein, der bewusst auch in Server
 * Components eingesetzt werden kann.
 *
 * Barrierefreiheit:
 *   - aria-label "Zurueck" auch dann, wenn das Wort sichtbar danebensteht
 *     (label={false} blendet nur die Schrift aus, nicht den Namen)
 *   - min-h-11 / min-w-11 = 44x44 CSS-Pixel Zielgroesse (SC 2.5.8)
 *   - sichtbarer Fokusring in beiden Varianten (SC 2.4.11/2.4.13)
 */

import { ArrowLeft } from 'lucide-react'
import { clsx } from 'clsx'
import { useAppBack } from '@/hooks/useAppBack'

export interface ZurueckButtonProps {
  /** Ziel, wenn keine In-App-History existiert (Deep Link, Push, Kaltstart) */
  fallback?: string
  /** hell = auf farbigem Header, dunkel = auf weissem Header */
  variant?: 'hell' | 'dunkel'
  /** Sichtbare Beschriftung neben dem Pfeil */
  label?: boolean
  className?: string
}

export function ZurueckButton({
  fallback = '/home',
  variant = 'hell',
  label = true,
  className,
}: ZurueckButtonProps) {
  const zurueck = useAppBack(fallback)

  return (
    <button
      type="button"
      onClick={zurueck}
      aria-label="Zurück"
      className={clsx(
        'tap-transparent -ml-2 inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-xl px-2',
        'text-sm font-semibold transition-transform duration-100 ease-out active:scale-[0.94]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        variant === 'hell'
          ? 'text-white hover:bg-white/10 focus-visible:outline-white'
          : 'text-primary-400 hover:bg-gray-100 focus-visible:outline-primary-400',
        className,
      )}
    >
      <ArrowLeft className="h-5 w-5 shrink-0" aria-hidden="true" />
      {label && <span aria-hidden="true">Zurück</span>}
    </button>
  )
}
