'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui'
import type { Organisation, Gewerbebranche } from '@/types/database'
import { compressImage } from '@/lib/compressImage'
import { createClient } from '@/lib/supabase/client'

interface GewerbeProfilFormProps {
  betrieb: Organisation
  branchen: Gewerbebranche[]
  onUpdated: (updated: Organisation) => void
}

export function GewerbeProfilForm({ betrieb, branchen, onUpdated }: GewerbeProfilFormProps) {
  const [name, setName] = useState(betrieb.name)
  const [brancheId, setBrancheId] = useState(betrieb.branche_id ?? '')
  const [beschreibung, setBeschreibung] = useState(betrieb.beschreibung ?? '')
  const [adresse, setAdresse] = useState(betrieb.adresse ?? '')
  const [oeffnungszeiten, setOeffnungszeiten] = useState(betrieb.oeffnungszeiten ?? '')
  const [website, setWebsite] = useState(betrieb.website ?? '')
  const [logoUrl, setLogoUrl] = useState(betrieb.logo_url ?? '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const compressed = await compressImage(file)
      const supabase = createClient()
      const path = `gewerbe/${betrieb.id}/logo_${Date.now()}.jpg`
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
      const isNew = !betrieb.id
      const payload = {
        name,
        branche_id: brancheId || null,
        beschreibung: beschreibung || null,
        adresse: adresse || null,
        oeffnungszeiten: oeffnungszeiten || null,
        website: website || null,
        logo_url: logoUrl || null,
      }
      const res = await fetch(
        isNew ? '/api/gewerbe/betrieb' : '/api/gewerbe/profil',
        {
          method: isNew ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(isNew ? payload : { gewerbeId: betrieb.id, ...payload }),
        },
      )
      if (!res.ok) throw new Error()
      const { betrieb: updated } = await res.json()
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
            <div className="w-16 h-16 rounded-xl bg-orange-100 flex items-center justify-center text-orange-400 text-2xl font-black">
              {name[0]?.toUpperCase()}
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

      <Field label="Betriebsname *">
        <input
          required
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </Field>

      <Field label="Branche">
        <select
          value={brancheId}
          onChange={e => setBrancheId(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
        >
          <option value="">– Bitte wählen –</option>
          {branchen.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </Field>

      <Field label="Kurzbeschreibung">
        <textarea
          rows={3}
          value={beschreibung}
          onChange={e => setBeschreibung(e.target.value)}
          placeholder="Was bieten Sie an?"
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
        />
      </Field>

      <Field label="Adresse">
        <input
          value={adresse}
          onChange={e => setAdresse(e.target.value)}
          placeholder="Musterstraße 1, 71234 Musterstadt"
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </Field>

      <Field label="Öffnungszeiten">
        <textarea
          rows={3}
          value={oeffnungszeiten}
          onChange={e => setOeffnungszeiten(e.target.value)}
          placeholder={`Mo–Fr: 08:00–18:00\nSa: 09:00–13:00`}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
        />
      </Field>

      <Field label="Website">
        <input
          type="url"
          value={website}
          onChange={e => setWebsite(e.target.value)}
          placeholder="https://www.meinbetrieb.de"
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
