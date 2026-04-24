'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  bilder: string[]
  startIndex?: number
  onClose: () => void
}

export default function GalleryLightbox({ bilder, startIndex = 0, onClose }: Props) {
  const [current, setCurrent] = useState(startIndex)

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
    <div className="fixed inset-0 bg-black/95 z-[200] flex flex-col" onClick={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" onClick={e => e.stopPropagation()}>
        <span className="text-white/60 text-sm font-medium">{current + 1} / {bilder.length}</span>
        <button onClick={onClose} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Hauptbild */}
      <div className="flex-1 flex items-center justify-center relative px-12 min-h-0" onClick={e => e.stopPropagation()}>
        {current > 0 && (
          <button onClick={prev}
            className="absolute left-2 p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10">
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        )}
        <img src={bilder[current]} className="max-w-full max-h-full object-contain rounded-xl select-none" alt="" />
        {current < bilder.length - 1 && (
          <button onClick={next}
            className="absolute right-2 p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10">
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        )}
      </div>

      {/* Thumbnails */}
      {bilder.length > 1 && (
        <div className="flex gap-2 justify-center py-4 overflow-x-auto px-4 shrink-0" onClick={e => e.stopPropagation()}>
          {bilder.map((url, i) => (
            <button key={i} onClick={() => setCurrent(i)}
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
