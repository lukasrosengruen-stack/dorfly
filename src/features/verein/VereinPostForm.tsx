'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Clock } from 'lucide-react'
import { RichTextEditor } from '@/lib/richText'
import { Button } from '@/components/ui'
import { compressImage } from '@/lib/compressImage'
import { createClient } from '@/lib/supabase/client'
import type { Post } from '@/types/database'

interface VereinPostFormProps {
  vereinId: string
  onCreated: (post: Post) => void
}

export function VereinPostForm({ vereinId, onCreated }: VereinPostFormProps) {
  const [text, setText]           = useState('')
  const [bildUrl, setBildUrl]     = useState<string | null>(null)
  const [ablaufdatum, setAblaufdatum] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving]       = useState(false)

  async function handleBildChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const compressed = await compressImage(file)
      const supabase = createClient()
      const path = `vereine/${vereinId}/post_${Date.now()}.jpg`
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
      const res = await fetch('/api/verein/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vereinId,
          text: text.trim(),
          bildUrl: bildUrl ?? undefined,
          ablaufdatum: ablaufdatum || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Fehler beim Erstellen'); return }
      onCreated(data.post)
      setText('')
      setBildUrl(null)
      setAblaufdatum('')
      toast.success('Beitrag zur Freigabe eingereicht')
    } catch {
      toast.error('Fehler beim Erstellen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
        <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 font-medium">
          Beiträge werden von der Verwaltung geprüft und danach freigegeben.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <RichTextEditor
          value={text}
          onChange={setText}
          placeholder="Was möchten Sie Ihrer Gemeinde mitteilen?"
          rows={4}
          compact
        />

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">
              Bild (optional)
            </label>
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
              <>
                <label className="cursor-pointer block">
                  <span className="block text-xs font-bold text-primary-500 bg-primary-50 px-3 py-2 rounded-xl text-center">
                    {uploading ? 'Lädt…' : 'Bild auswählen'}
                  </span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleBildChange} disabled={uploading} />
                </label>
                <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">
                  Das Seitenverhältnis bleibt erhalten. Empfohlen: quadratisch oder 4:3.
                </p>
              </>
            )}
          </div>

          <div className="flex-1">
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">
              Ablaufdatum (optional)
            </label>
            <input
              type="date"
              value={ablaufdatum}
              onChange={e => setAblaufdatum(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <Button type="submit" fullWidth loading={saving || uploading}>
          Zur Freigabe einreichen
        </Button>
      </form>
    </div>
  )
}
