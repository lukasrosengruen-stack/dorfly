'use client'

import { useId, useState } from 'react'
import { toast } from 'sonner'
import { RichTextEditor } from '@/lib/richText'
import { Button } from '@/components/ui'
import { compressImage } from '@/lib/compressImage'
import { createClient } from '@/lib/supabase/client'
import type { Post } from '@/types/database'

interface GewerbePostFormProps {
  gewerbeId: string
  onCreated: (post: Post) => void
}

export function GewerbePostForm({ gewerbeId, onCreated }: GewerbePostFormProps) {
  const feldId = useId()
  const [titel, setTitel] = useState('')
  const [text, setText] = useState('')
  const [bildUrl, setBildUrl] = useState<string | null>(null)
  const [bildrechteBestaetigt, setBildrechteBestaetigt] = useState(false)
  const [ablaufdatum, setAblaufdatum] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleBildChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const compressed = await compressImage(file)
      const supabase = createClient()
      const path = `gewerbe/${gewerbeId}/post_${Date.now()}.jpg`
      const { error } = await supabase.storage.from('dorfly-media').upload(path, compressed)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('dorfly-media').getPublicUrl(path)
      setBildUrl(publicUrl)
    } catch {
      toast.error('Bild-Upload fehlgeschlagen')
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/gewerbe/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gewerbeId,
          titel: titel.trim() || undefined,
          text: text.trim(),
          bildUrl: bildUrl ?? undefined,
          ablaufdatum: ablaufdatum || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Fehler beim Erstellen')
        return
      }
      onCreated(data.post)
      setTitel('')
      setText('')
      setBildUrl(null)
      setBildrechteBestaetigt(false)
      setAblaufdatum('')
      toast.success('Beitrag veröffentlicht')
    } catch {
      toast.error('Fehler beim Erstellen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor={`${feldId}-titel`} className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">
          Überschrift (optional)
        </label>
        <input
          id={`${feldId}-titel`}
          type="text"
          value={titel}
          onChange={e => setTitel(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
      <div>
        <p id={`${feldId}-text`} className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">
          Text
        </p>
        <RichTextEditor
          value={text}
          onChange={setText}
          placeholder="Was möchten Sie Ihrer Gemeinde mitteilen?"
          rows={4}
          compact
          labelledBy={`${feldId}-text`}
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          {/* Kein <label>: das Dateifeld unten hat über „Bild auswählen“ einen eigenen Namen */}
          <p className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">
            Bild (optional)
          </p>
          {bildUrl ? (
            <div className="relative">
              <img src={bildUrl} alt="Vorschau" className="w-full h-32 object-cover rounded-xl" />
              <button
                type="button"
                onClick={() => setBildUrl(null)}
                className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full"
              >
                Entfernen
              </button>
            </div>
          ) : (
            <label className="cursor-pointer block">
              <span className="block text-xs font-bold text-primary-500 bg-primary-50 px-3 py-2 rounded-xl text-center">
                {uploading ? 'Lädt…' : 'Bild auswählen'}
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={handleBildChange} disabled={uploading} />
            </label>
          )}
        </div>

        <div className="flex-1">
          <label htmlFor={`${feldId}-ablauf`} className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">
            Ablaufdatum (optional)
          </label>
          <input
            id={`${feldId}-ablauf`}
            type="date"
            value={ablaufdatum}
            onChange={e => setAblaufdatum(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {bildUrl && (
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={bildrechteBestaetigt}
            onChange={e => setBildrechteBestaetigt(e.target.checked)}
            className="mt-0.5 rounded shrink-0"
          />
          <span className="text-xs text-gray-600 leading-relaxed">
            Ich bestätige, dass ich die erforderlichen Nutzungsrechte an diesem Bild besitze und es für die Veröffentlichung durch die Kommune freigebe.
          </span>
        </label>
      )}
      <Button type="submit" fullWidth loading={saving || uploading} disabled={saving || uploading || (!!bildUrl && !bildrechteBestaetigt)}>
        Beitrag veröffentlichen
      </Button>
    </form>
  )
}
