'use client'

/**
 * PostBild – Beitragsbild in Newsfeed-Darstellung.
 *
 * Aus FeedCard herausgeloest, damit Veranstaltungen exakt dieselbe Darstellung
 * bekommen statt einer zweiten Implementierung. Die Bildregeln selbst stehen
 * unveraendert in globals.css (.feed-bild-rahmen / .feed-bild): natuerliches
 * Seitenverhaeltnis innerhalb des Korridors 1.91:1 bis 4:5, beschnitten wird
 * nur, was ausserhalb liegt. Deshalb laufen Hochkant-Plakate wie das
 * Zwiebelkuchenfest hier nicht mehr in einen festen 160px-Rahmen.
 *
 * Galerie-Status:
 *   - ohne onOeffnen verwaltet die Komponente ihre Lightbox selbst
 *   - mit onOeffnen meldet sie den Klick nur nach oben. Die FeedCard nutzt das,
 *     weil dort auch der "N Fotos"-Knopf im Kanal-Banner dieselbe Galerie
 *     oeffnet und beide sich einen Status teilen muessen.
 */

import { useState } from 'react'
import { Images } from 'lucide-react'
import GalleryLightbox from '@/components/GalleryLightbox'

export interface PostBildProps {
  /** Alle Bilder des Beitrags. Leer = nichts wird gerendert. */
  bilder: string[]
  /**
   * Alt-Text des ersten Bildes. Im Newsfeed ist das der Beitragstitel — das
   * Bild illustriert den Beitrag, eine eigene Bildbeschreibung gibt es nicht.
   */
  alt: string
  /** Uebernimmt das Oeffnen der Galerie (siehe oben). */
  onOeffnen?: () => void
}

export function PostBild({ bilder, alt, onOeffnen }: PostBildProps) {
  const [offen, setOffen] = useState(false)

  if (bilder.length === 0) return null

  const mehrere = bilder.length > 1

  return (
    <>
      <button
        type="button"
        className="relative w-full cursor-pointer"
        onClick={() => (onOeffnen ? onOeffnen() : setOffen(true))}
        aria-label={`Bildergalerie öffnen (${bilder.length} ${mehrere ? 'Bilder' : 'Bild'})`}
      >
        <span className="feed-bild-rahmen block">
          <img src={bilder[0]} alt={alt} className="feed-bild" />
        </span>
        {mehrere && (
          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
            <Images className="w-3 h-3" aria-hidden="true" /> {bilder.length}
          </div>
        )}
      </button>

      {offen && (
        <GalleryLightbox bilder={bilder} startIndex={0} onClose={() => setOffen(false)} />
      )}
    </>
  )
}
