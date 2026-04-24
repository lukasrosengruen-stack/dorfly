'use client'

import { useRef } from 'react'
import { ImagePlus, X } from 'lucide-react'

interface Props {
  previews: string[]
  onAdd: (files: File[]) => void
  onRemove: (index: number) => void
  id: string
}

export default function BilderUpload({ previews, onAdd, onRemove, id }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length) onAdd(files)
    e.target.value = ''
  }

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" accept="image/*" multiple id={id} className="hidden" onChange={handleChange} />
      <button type="button" onClick={() => inputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-gray-300 text-sm font-bold text-gray-500 hover:border-primary-400 hover:text-primary-500 transition-colors">
        <ImagePlus className="w-4 h-4" />
        {previews.length > 0 ? `${previews.length} Bild${previews.length > 1 ? 'er' : ''} • Weitere hinzufügen` : 'Bilder hinzufügen'}
      </button>
      {previews.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {previews.map((src, i) => (
            <div key={i} className="relative aspect-square">
              <img src={src} className="w-full h-full object-cover rounded-xl" alt="" />
              <button type="button" onClick={() => onRemove(i)}
                className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5">
                <X className="w-3.5 h-3.5 text-white" />
              </button>
              {i === 0 && (
                <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">Cover</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
