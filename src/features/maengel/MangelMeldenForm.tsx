'use client'

/**
 * MangelMeldenForm – Modal-Formular zum Melden eines Schadens
 *
 * Alle Mutations-Logik (Supabase, Bild-Upload) befindet sich hier.
 * Das Ergebnis (neuer Mangel) wird via onSuccess nach oben gemeldet.
 */
import { useState } from 'react'
import { toast } from 'sonner'
import { X, MapPin, Camera as CameraIcon, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { Capacitor } from '@capacitor/core'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Geolocation } from '@capacitor/geolocation'
import { Profile, Mangel } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/compressImage'
import { Button } from '@/components/ui'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface MangelMeldenFormProps {
  profile: Profile
  onClose: () => void
  onSuccess: (neuerMangel: Mangel) => void
}

export function MangelMeldenForm({ profile, onClose, onSuccess }: MangelMeldenFormProps) {
  const supabase = createClient()
  const trapRef = useFocusTrap(true)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ titel: '', beschreibung: '', adresse: '', fotoAlt: '' })
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

  async function handleFotoNative() {
    try {
      const permission = await Camera.requestPermissions({ permissions: ['camera'] })
      if (permission.camera === 'denied') {
        toast.error('Kamera-Zugriff verweigert – bitte in den iOS-Einstellungen für Dorfly erlauben')
        return
      }

      const foto = await Camera.getPhoto({
        quality: 70,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      })
      if (!foto.dataUrl) return

      const blob = await fetch(foto.dataUrl).then(r => r.blob())
      const file = new File([blob], `foto-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' })
      setFotoFile(file)
      setFotoPreview(foto.dataUrl)
    } catch (e) {
      if (e instanceof Error && /cancelled/i.test(e.message)) return
      console.error('[Kamera]', e)
      toast.error('Foto konnte nicht aufgenommen werden')
    }
  }

  function handleFotoButtonClick() {
    if (Capacitor.isNativePlatform()) {
      handleFotoNative()
      return
    }
    document.getElementById('foto-input')?.click()
  }

  async function getLocation() {
    setLocating(true)

    if (Capacitor.isNativePlatform()) {
      try {
        const permission = await Geolocation.requestPermissions()
        if (permission.location === 'denied') {
          toast.error('Standort-Zugriff verweigert – bitte in den iOS-Einstellungen für Dorfly erlauben')
          return
        }
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true })
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      } catch (e) {
        console.error('[Standort]', e)
        toast.error('Standort nicht verfügbar')
      } finally {
        setLocating(false)
      }
      return
    }

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
    <div
      className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
      onKeyDown={e => e.key === 'Escape' && onClose()}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mangel-modal-title"
        className="bg-white w-full max-w-lg rounded-2xl max-h-[85vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b sticky top-0 bg-white">
          <h2 id="mangel-modal-title" className="font-bold text-gray-900">Schaden melden</h2>
          <button onClick={onClose} aria-label="Formular schließen">
            <X className="w-5 h-5 text-gray-500" aria-hidden="true" />
          </button>
        </div>

        {/* Felder */}
        <div className="p-4 space-y-3">
          <div>
            <label htmlFor="mangel-titel" className="sr-only">Titel (Pflichtfeld)</label>
            <input
              id="mangel-titel"
              type="text"
              placeholder="Titel (z. B. Schlagloch Hauptstraße)"
              value={form.titel}
              onChange={e => setForm(f => ({ ...f, titel: e.target.value }))}
              required
              aria-required="true"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label htmlFor="mangel-beschreibung" className="sr-only">Beschreibung (optional)</label>
            <textarea
              id="mangel-beschreibung"
              placeholder="Beschreibung (optional)"
              value={form.beschreibung}
              onChange={e => setForm(f => ({ ...f, beschreibung: e.target.value }))}
              rows={3}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label htmlFor="mangel-adresse" className="sr-only">Adresse oder Ort (optional)</label>
            <input
              id="mangel-adresse"
              type="text"
              placeholder="Adresse / Ort (optional)"
              value={form.adresse}
              onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

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
            {locating ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <MapPin className="w-4 h-4" aria-hidden="true" />}
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
            onClick={handleFotoButtonClick}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-gray-300 text-sm font-medium text-gray-600"
          >
            <CameraIcon className="w-4 h-4" aria-hidden="true" />
            {fotoFile ? fotoFile.name : 'Foto aufnehmen'}
          </button>

          {fotoPreview && (
            <div className="space-y-2">
              <div className="relative">
                <img
                  src={fotoPreview}
                  alt={form.fotoAlt || 'Vorschau des ausgewählten Fotos'}
                  className="w-full h-40 object-cover rounded-xl"
                />
                <button
                  onClick={() => { setFotoFile(null); setFotoPreview(null); setForm(f => ({ ...f, fotoAlt: '' })) }}
                  aria-label="Foto entfernen"
                  className="absolute top-2 right-2 bg-black/50 rounded-full p-1"
                >
                  <X className="w-4 h-4 text-white" aria-hidden="true" />
                </button>
              </div>
              <div>
                <label htmlFor="mangel-foto-alt" className="sr-only">Bildbeschreibung (optional, für Barrierefreiheit)</label>
                <input
                  id="mangel-foto-alt"
                  type="text"
                  placeholder="Bildbeschreibung (optional)"
                  value={form.fotoAlt}
                  onChange={e => setForm(f => ({ ...f, fotoAlt: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
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
