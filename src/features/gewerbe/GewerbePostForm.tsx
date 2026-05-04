'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Lock } from 'lucide-react'
import { RichTextEditor } from '@/lib/richText'
import { Button } from '@/components/ui'
import { compressImage } from '@/lib/compressImage'
import { createClient } from '@/lib/supabase/client'
import type { Post } from '@/types/database'

interface GewerbePostFormProps {
  gewerbeId: string
  /** ISO-String des nächsten Montags, wenn das Limit erreicht ist. Null wenn noch möglich. */
  naechsterMontag: string | null
  onCreated: (post: Post) => void
}

export function GewerbePostForm({ gewerbeId, naechsterMontag, onCreated }: GewerbePostFormProps) {
  const [text, setText] = useState('')
  const [bildUrl, setBildUrl] = useState<string | null>(null)
  const [ablaufdatum, setAblaufdatum] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sendPush, setSendPush] = useState(false)

  const gesperrt = naechsterMontag !== null

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
      if (sendPush) {
        await fetch('/api/notifications/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Neues Angebot', message: text.trim().slice(0, 150), url: '/feed' }),
        })
      }
      setText('')
      setBildUrl(null)
      setAblaufdatum('')
      setSendPush(false)
      toast.success('Beitrag veröffentlicht')
    } catch {
      toast.error('Fehler beim Erstellen')
    } finally {
      setSaving(false)
    }
  }

  if (gesperrt) {
    const datum = new Date(naechsterMontag!).toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
    return (
      <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-500">
        <Lock className="w-4 h-4 shrink-0 text-gray-400" />
        <span>
          Nächster Post möglich ab{' '}
          <span className="font-bold text-gray-700">{datum}</span>
        </span>
      </div>
    )
  }

  return (
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
            <label className="cursor-pointer block">
              <span className="block text-xs font-bold text-primary-500 bg-primary-50 px-3 py-2 rounded-xl text-center">
                {uploading ? 'Lädt…' : 'Bild auswählen'}
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={handleBildChange} disabled={uploading} />
            </label>
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

      <label className="flex items-center gap-2 text-sm font-bold text-red-700 cursor-pointer bg-red-50 px-3 py-2.5 rounded-xl border border-red-200">
        <input type="checkbox" checked={sendPush} onChange={e => setSendPush(e.target.checked)} className="rounded accent-red-600" />
        🔔 Push-Benachrichtigung senden (alle Nutzer)
      </label>

      <Button type="submit" fullWidth loading={saving || uploading}>
        Beitrag veröffentlichen
      </Button>
    </form>
  )
}
