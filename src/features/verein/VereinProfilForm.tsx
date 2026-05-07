'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui'
import type { Verein, VereinKategorie } from '@/types/database'
import { compressImage } from '@/lib/compressImage'
import { createClient } from '@/lib/supabase/client'

interface VereinProfilFormProps {
  verein: Verein
  kategorien: VereinKategorie[]
  onUpdated: (updated: Verein) => void
}

export function VereinProfilForm({ verein, kategorien, onUpdated }: VereinProfilFormProps) {
  const [vereinName, setVereinName] = useState(verein.verein_name)
  const [kategorieId, setKategorieId] = useState(verein.kategorie_id ?? '')
  const [beschreibung, setBeschreibung] = useState(verein.beschreibung ?? '')
  const [website, setWebsite] = useState(verein.website ?? '')
  const [logoUrl, setLogoUrl] = useState(verein.logo_url ?? '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const compressed = await compressImage(file)
      const supabase = createClient()
      const path = `vereine/${verein.id || 'neu'}/logo_${Date.now()}.jpg`
      const { error } = await supabase.storage.from('dorfly-media').upload(path, compressed, { upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('dorfly-media').getPublicUrl(path)
      setLogoUrl(publicUrl)
    } catch {
      toast.error('Logo-Upload fehlgeschlagen')
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const isNew = !verein.id
      const payload = {
        verein_name: vereinName,
        kategorie_id: kategorieId || null,
        beschreibung: beschreibung || null,
        website: website || null,
        logo_url: logoUrl || null,
      }
      const res = await fetch(
        isNew ? '/api/verein/profil' : '/api/verein/profil',
        {
          method: isNew ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(isNew ? payload : { vereinId: verein.id, ...payload }),
        },
      )
      if (!res.ok) throw new Error()
      const { verein: updated } = await res.json()
      onUpdated(updated)
      toast.success(isNew ? 'Profil angelegt' : 'Profil gespeichert')
    } catch {
      toast.error('Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Logo */}
      <div>
        <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">
          Logo
        </label>
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-16 h-16 rounded-xl object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-violet-100 flex items-center justify-center text-violet-500 text-2xl font-black">
              {vereinName[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <label className="cursor-pointer">
            <span className="text-xs font-bold text-primary-500 bg-primary-50 px-3 py-2 rounded-xl">
              {uploading ? 'Lädt…' : 'Bild auswählen'}
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} disabled={uploading} />
          </label>
        </div>
      </div>

      <Field label="Name *">
        <input
          required
          value={vereinName}
          onChange={e => setVereinName(e.target.value)}
          placeholder="Name des Vereins oder der Organisation"
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </Field>

      <Field label="Kategorie">
        <select
          value={kategorieId}
          onChange={e => setKategorieId(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
        >
          <option value="">– Bitte wählen –</option>
          {kategorien.map(k => (
            <option key={k.id} value={k.id}>{k.name}</option>
          ))}
        </select>
      </Field>

      <Field label="Kurzbeschreibung">
        <textarea
          rows={3}
          value={beschreibung}
          onChange={e => setBeschreibung(e.target.value)}
          placeholder="Was macht Ihr Verein / Ihre Organisation?"
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
        />
      </Field>

      <Field label="Website">
        <input
          type="url"
          value={website}
          onChange={e => setWebsite(e.target.value)}
          placeholder="https://www.meinverein.de"
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </Field>

      <Button type="submit" fullWidth loading={saving} disabled={uploading}>
        Profil speichern
      </Button>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}
