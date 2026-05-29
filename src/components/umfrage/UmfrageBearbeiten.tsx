'use client'

import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Loader2 } from 'lucide-react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { RichTextEditor } from '@/lib/richText'
import { Umfrage } from '@/types/umfrage'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/compressImage'
import BilderUpload from '@/components/dashboard/BilderUpload'
import { toast } from 'sonner'

const schema = z.object({
  titel: z.string().min(1, 'Titel erforderlich').max(200),
  beschreibung: z.string().max(1000).optional(),
  enddatum: z.string().min(1, 'Enddatum erforderlich'),
})

type FormValues = z.infer<typeof schema>

interface Props {
  umfrage: Umfrage
  onClose: () => void
  onUpdate: (umfrage: Umfrage) => void
}

export default function UmfrageBearbeiten({ umfrage, onClose, onUpdate }: Props) {
  const containerRef = useFocusTrap(true)
  const [serverError, setServerError] = useState('')
  const [umfrageBilder, setUmfrageBilder] = useState<string[]>(umfrage.bilder_urls ?? [])
  const [fragenBilder, setFragenBilder] = useState<Record<string, string[]>>(
    Object.fromEntries(
      (umfrage.umfrage_fragen ?? []).map(f => [f.id, f.bilder_urls ?? []])
    )
  )

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null
    return () => { trigger?.focus() }
  }, [])

  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      titel: umfrage.titel,
      beschreibung: umfrage.beschreibung ?? '',
      enddatum: umfrage.enddatum.slice(0, 16),
    },
  })

  async function uploadBilder(files: File[]): Promise<string[]> {
    const supabase = createClient()
    const urls: string[] = []
    for (const file of files) {
      const compressed = await compressImage(file)
      const path = `umfragen/${umfrage.id}/${Date.now()}_${compressed.name}`
      const { error: uploadError } = await supabase.storage.from('dorfly-media').upload(path, compressed)
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('dorfly-media').getPublicUrl(path)
      urls.push(publicUrl)
    }
    return urls
  }

  async function handleUmfrageBilderAdd(files: File[]) {
    try {
      const newUrls = await uploadBilder(files)
      setUmfrageBilder(prev => [...prev, ...newUrls])
    } catch {
      toast.error('Bild-Upload fehlgeschlagen')
    }
  }

  function handleUmfrageBilderRemove(index: number) {
    setUmfrageBilder(prev => prev.filter((_, i) => i !== index))
  }

  async function handleFrageBilderAdd(frageId: string, files: File[]) {
    try {
      const newUrls = await uploadBilder(files)
      setFragenBilder(prev => ({ ...prev, [frageId]: [...(prev[frageId] ?? []), ...newUrls] }))
    } catch {
      toast.error('Bild-Upload fehlgeschlagen')
    }
  }

  function handleFrageBilderRemove(frageId: string, index: number) {
    setFragenBilder(prev => ({
      ...prev,
      [frageId]: (prev[frageId] ?? []).filter((_, i) => i !== index),
    }))
  }

  async function onSubmit(values: FormValues) {
    setServerError('')
    try {
      const fragen_bilder = Object.entries(fragenBilder).map(([id, bilder_urls]) => ({ id, bilder_urls }))
      const res = await fetch('/api/umfragen/bearbeiten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: umfrage.id,
          ...values,
          bilder_urls: umfrageBilder,
          fragen_bilder,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Fehler beim Speichern')
      onUpdate(data.umfrage)
      onClose()
    } catch (e: unknown) {
      setServerError(e instanceof Error ? e.message : 'Fehler beim Speichern')
    }
  }

  const sortierteFragen = [...(umfrage.umfrage_fragen ?? [])].sort((a, b) => a.reihenfolge - b.reihenfolge)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="umfrage-bearbeiten-titel"
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 id="umfrage-bearbeiten-titel" className="font-bold text-gray-900">Umfrage bearbeiten</h2>
          <button onClick={onClose} aria-label="Schließen" className="rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
            <X className="w-5 h-5 text-gray-400" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <label htmlFor="umfrage-titel" className="block text-sm font-medium text-gray-700 mb-1">
              Titel
            </label>
            <input
              id="umfrage-titel"
              type="text"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
              {...register('titel')}
            />
            {errors.titel && (
              <p role="alert" className="text-red-500 text-xs mt-1">{errors.titel.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Beschreibung
            </label>
            <Controller
              name="beschreibung"
              control={control}
              render={({ field }) => (
                <RichTextEditor
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  placeholder="Beschreibung (optional)"
                  rows={4}
                />
              )}
            />
            {errors.beschreibung && (
              <p role="alert" className="text-red-500 text-xs mt-1">{errors.beschreibung.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bilder zur Umfrage
            </label>
            <BilderUpload
              id="umfrage-bearbeiten-bilder"
              previews={umfrageBilder}
              onAdd={handleUmfrageBilderAdd}
              onRemove={handleUmfrageBilderRemove}
            />
          </div>

          <div>
            <label htmlFor="umfrage-enddatum" className="block text-sm font-medium text-gray-700 mb-1">
              Enddatum
            </label>
            <input
              id="umfrage-enddatum"
              type="datetime-local"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
              {...register('enddatum')}
            />
            {errors.enddatum && (
              <p role="alert" className="text-red-500 text-xs mt-1">{errors.enddatum.message}</p>
            )}
          </div>

          {sortierteFragen.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Bilder zu den Fragen</p>
              {sortierteFragen.map((frage, idx) => (
                <div key={frage.id} className="border border-gray-200 rounded-xl p-3 space-y-2">
                  <p className="text-sm text-gray-600">{idx + 1}. {frage.frage_text}</p>
                  <BilderUpload
                    id={`frage-bearbeiten-bilder-${frage.id}`}
                    previews={fragenBilder[frage.id] ?? []}
                    onAdd={files => handleFrageBilderAdd(frage.id, files)}
                    onRemove={i => handleFrageBilderRemove(frage.id, i)}
                  />
                </div>
              ))}
            </div>
          )}

          {serverError && (
            <p role="alert" className="text-red-500 text-sm">{serverError}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-xl text-sm"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-primary-500 text-white font-medium py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
