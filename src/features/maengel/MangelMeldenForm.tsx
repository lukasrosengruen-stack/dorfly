'use client'

/**
 * MangelMeldenForm – Modal-Formular zum Melden eines Schadens
 *
 * Alle Mutations-Logik (Supabase, Bild-Upload) befindet sich hier.
 * Das Ergebnis (neuer Mangel) wird via onSuccess nach oben gemeldet.
 */
import { useState } from 'react'
import { toast } from 'sonner'
import { X, MapPin, Camera, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { Profile, Mangel } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/compressImage'
import { Button } from '@/components/ui'

interface MangelMeldenFormProps {
  profile: Profile
  onClose: () => void
  onSuccess: (neuerMangel: Mangel) => void
}

export function MangelMeldenForm({ profile, onClose, onSuccess }: MangelMeldenFormProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ titel: '', beschreibung: '', adresse: '' })
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)

  function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFotoFile(file)
    setFotoPreview(URL.createObjectURL(file))
  }

  function getLocation() {
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
      },
      () => {
        toast.error('Standort nicht verfügbar')
        setLocating(false)
      },
      { timeout: 10000 },
    )
  }

  async function submit() {
    if (!form.titel || !profile.gemeinde_id) return
    setLoading(true)
    try {
      let foto_url: string | null = null
      if (fotoFile) {
        const compressed = await compressImage(fotoFile)
        const path = `maengel/${Date.now()}.jpg`
        const { error: uploadErr } = await supabase.storage
          .from('dorfly-media')
          .upload(path, compressed)
        if (!uploadErr) {
          const { data } = supabase.storage.from('dorfly-media').getPublicUrl(path)
          foto_url = data.publicUrl
        }
      }

      const { data, error } = await supabase
        .from('maengel')
        .insert({
          gemeinde_id:  profile.gemeinde_id!,
          melder_id:    profile.id,
          titel:        form.titel,
          beschreibung: form.beschreibung || null,
          adresse:      form.adresse || null,
          lat:          coords?.lat ?? null,
          lng:          coords?.lng ?? null,
          foto_url,
          status:       'offen',
        })
        .select('*, profiles(display_name)')
        .single()

      if (error) throw error
      onSuccess(data as Mangel)
      onClose()
    } catch {
      toast.error('Fehler beim Speichern')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b sticky top-0 bg-white">
          <h2 className="font-bold text-gray-900">Schaden melden</h2>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Felder */}
        <div className="p-4 space-y-3">
          <input
            type="text"
            placeholder="Titel (z. B. Schlagloch Hauptstraße)"
            value={form.titel}
            onChange={e => setForm(f => ({ ...f, titel: e.target.value }))}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <textarea
            placeholder="Beschreibung (optional)"
            value={form.beschreibung}
            onChange={e => setForm(f => ({ ...f, beschreibung: e.target.value }))}
            rows={3}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <input
            type="text"
            placeholder="Adresse / Ort (optional)"
            value={form.adresse}
            onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />

          {/* GPS */}
          <button
            onClick={getLocation}
            disabled={locating}
            className={clsx(
              'w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-medium transition-colors',
              coords
                ? 'border-primary-500 text-primary-500 bg-primary-50'
                : 'border-gray-300 text-gray-600',
            )}
          >
            {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
            {coords
              ? `GPS: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
              : 'GPS-Standort erfassen'}
          </button>

          {/* Foto */}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            id="foto-input"
            onChange={handleFoto}
          />
          <button
            onClick={() => document.getElementById('foto-input')?.click()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-gray-300 text-sm font-medium text-gray-600"
          >
            <Camera className="w-4 h-4" />
            {fotoFile ? fotoFile.name : 'Foto aufnehmen'}
          </button>

          {fotoPreview && (
            <div className="relative">
              <img src={fotoPreview} alt="Vorschau" className="w-full h-40 object-cover rounded-xl" />
              <button
                onClick={() => { setFotoFile(null); setFotoPreview(null) }}
                className="absolute top-2 right-2 bg-black/50 rounded-full p-1"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          )}

          <Button
            variant="primary"
            fullWidth
            loading={loading}
            disabled={!form.titel}
            onClick={submit}
          >
            Meldung abschicken
          </Button>
        </div>
      </div>
    </div>
  )
}
