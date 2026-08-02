'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface Props {
  bilder: string[]
  startIndex?: number
  onClose: () => void
}

export default function GalleryLightbox({ bilder, startIndex = 0, onClose }: Props) {
  const [current, setCurrent] = useState(startIndex)
  const trapRef = useFocusTrap(true)

  const prev = useCallback(() => setCurrent(c => Math.max(0, c - 1)), [])
  const next = useCallback(() => setCurrent(c => Math.min(bilder.length - 1, c + 1)), [bilder.length])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, prev, next])

  return (
    <div
      ref={trapRef}
      role="dialog"
      aria-modal="true"
      aria-label="Bildergalerie"
      className="fixed inset-0 bg-black/95 z-[200] flex flex-col"
      onClick={onClose}
    >
      {/* Header – pt-safe hält das Schließen-X unter Notch/Dynamic Island frei */}
      <div className="pt-safe-bar flex items-center justify-between px-4 pb-3 shrink-0" onClick={e => e.stopPropagation()}>
        <span className="text-white/80 text-sm font-medium">{current + 1} / {bilder.length}</span>
        <button onClick={onClose} aria-label="Galerie schließen" className="tap-transparent flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20 active:scale-[0.96]">
          <X className="w-5 h-5 text-white" aria-hidden="true" />
        </button>
      </div>

      {/* Hauptbild */}
      <div className="flex-1 flex items-center justify-center relative px-12 min-h-0" onClick={onClose}>
        {current > 0 && (
          <button onClick={e => { e.stopPropagation(); prev() }} aria-label="Vorheriges Bild"
            className="absolute left-2 p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10">
            <ChevronLeft className="w-6 h-6 text-white" aria-hidden="true" />
          </button>
        )}
        <span className="sr-only" aria-live="polite" aria-atomic="true">
          Bild {current + 1} von {bilder.length}
        </span>
        <img src={bilder[current]} className="max-w-full max-h-full object-contain rounded-xl select-none" alt="" onClick={e => e.stopPropagation()} />
        {current < bilder.length - 1 && (
          <button onClick={e => { e.stopPropagation(); next() }} aria-label="Nächstes Bild"
            className="absolute right-2 p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10">
            <ChevronRight className="w-6 h-6 text-white" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Thumbnails */}
      {bilder.length > 1 && (
        <div className="flex gap-2 justify-center py-4 overflow-x-auto px-4 shrink-0" onClick={e => e.stopPropagation()}>
          {bilder.map((url, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              aria-label={`Bild ${i + 1} von ${bilder.length}`}
              aria-pressed={i === current}
              className={`w-14 h-14 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${
                i === current ? 'border-white scale-110' : 'border-transparent opacity-50 hover:opacity-75'
              }`}>
              <img src={url} className="w-full h-full object-cover" alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
