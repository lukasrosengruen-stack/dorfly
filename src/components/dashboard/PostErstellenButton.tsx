'use client'


import { toast } from 'sonner'
import { useState } from 'react'
import { Plus, X, Loader2, Clock } from 'lucide-react'
import { RichTextEditor } from '@/lib/richText'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/compressImage'
import { clsx } from 'clsx'
import BilderUpload from './BilderUpload'

const TAGS = ['nachricht', 'veranstaltung', 'bekanntmachung'] as const
const GEMEINDERAT_TAGS = ['eigene_position', 'fraktionsposition'] as const
type PostTag = typeof TAGS[number] | typeof GEMEINDERAT_TAGS[number]
const TAG_LABELS: Record<PostTag, string> = {
  nachricht: 'Nachricht', veranstaltung: 'Veranstaltung', bekanntmachung: 'Bekanntmachung',
  eigene_position: 'Eigene Position', fraktionsposition: 'Fraktionsposition',
}

interface Props {
  gemeindeId: string
  profileId: string
  defaultChannel?: 'gemeinde' | 'verein' | 'gewerbe' | 'gemeinderat'
  canPin?: boolean
  canPush?: boolean
}

export default function PostErstellenButton({ gemeindeId, profileId, defaultChannel, canPin = false, canPush = false }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [bildFiles, setBildFiles] = useState<File[]>([])
  const [bildPreviews, setBildPreviews] = useState<string[]>([])
  const [bildrechteBestaetigt, setBildrechteBestaetigt] = useState(false)
  const [form, setForm] = useState({ titel: '', inhalt: '', tag: (defaultChannel === 'gemeinderat' ? 'eigene_position' : 'nachricht') as PostTag, channel: (defaultChannel ?? 'gemeinde') as 'gemeinde' | 'verein' | 'gewerbe' | 'gemeinderat', veranstaltung_datum: '', veranstaltung_uhrzeit: '', veranstaltung_ort: '', pinned: false, push: false, geplant: false, scheduled_date: '', scheduled_time: '' })
  const supabase = createClient()

  function addBilder(files: File[]) {
    setBildFiles(prev => [...prev, ...files])
    setBildPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))])
  }

  function removeBild(index: number) {
    setBildFiles(prev => prev.filter((_, i) => i !== index))
    setBildPreviews(prev => prev.filter((_, i) => i !== index))
  }

  async function uploadBilder(): Promise<string[]> {
    return Promise.all(bildFiles.map(async file => {
      const compressed = await compressImage(file)
      const path = `posts/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
      const { error } = await supabase.storage.from('dorfly-media').upload(path, compressed)
      if (error) return null
      return supabase.storage.from('dorfly-media').getPublicUrl(path).data.publicUrl
    })).then(urls => urls.filter(Boolean) as string[])
  }

  function reset() {
    setShowForm(false)
    setForm({ titel: '', inhalt: '', tag: defaultChannel === 'gemeinderat' ? 'eigene_position' : 'nachricht', channel: (defaultChannel ?? 'gemeinde') as 'gemeinde' | 'verein' | 'gewerbe' | 'gemeinderat', veranstaltung_datum: '', veranstaltung_uhrzeit: '', veranstaltung_ort: '', pinned: false, push: false, geplant: false, scheduled_date: '', scheduled_time: '' })
    setBildFiles([]); setBildPreviews([]); setBildrechteBestaetigt(false)
  }

  async function submit() {
    if (!form.titel || !form.inhalt) return
    setLoading(true)
    try {
      const bilder_urls = await uploadBilder()
      const bild_url = bilder_urls[0] ?? null
      const publishAt = form.geplant && form.scheduled_date
        ? new Date(`${form.scheduled_date}T${form.scheduled_time || '08:00'}`).toISOString()
        : null
      const veranstaltungDatum = form.tag === 'veranstaltung' && form.veranstaltung_datum
        ? new Date(`${form.veranstaltung_datum}T${form.veranstaltung_uhrzeit || '00:00'}`).toISOString() : null
      const veranstaltungOrt = form.tag === 'veranstaltung' && form.veranstaltung_ort ? form.veranstaltung_ort : null

      if (form.channel === 'gemeinderat') {
        const res = await fetch('/api/gemeinderat/post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gemeindeId, titel: form.titel, inhalt: form.inhalt, tag: form.tag,
            bildUrl: bild_url, bilderUrls: bilder_urls,
            publishAt, publishedAt: publishAt ?? new Date().toISOString(),
            veranstaltungDatum, veranstaltungOrt,
          }),
        })
        if (!res.ok) throw new Error('API error')
      } else {
        const { error } = await supabase.from('posts').insert({
          gemeinde_id: gemeindeId, author_id: profileId,
          channel: form.channel, titel: form.titel, inhalt: form.inhalt,
          tag: form.tag, status: 'published', pinned: form.pinned,
          bild_url, bilder_urls,
          publish_at: publishAt,
          published_at: publishAt ?? new Date().toISOString(),
          veranstaltung_datum: veranstaltungDatum,
          veranstaltung_ort: veranstaltungOrt,
        }).select('id').single()
        if (error) throw error
        if (form.push) {
          await fetch('/api/notifications/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: form.titel, message: form.inhalt.slice(0, 150), url: '/feed' }),
          })
        }
      }

      reset()
      window.location.reload()
    } catch (err) {
      console.error('[PostErstellenButton] Fehler beim Erstellen:', err)
      const msg = (err as { message?: string })?.message
      toast.error(msg ? `Fehler: ${msg}` : 'Fehler beim Erstellen')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button onClick={() => setShowForm(true)}
        className="flex items-center gap-2 bg-primary-500 text-white font-bold px-4 py-2 rounded-xl text-sm hover:bg-primary-600 transition-colors">
        <Plus className="w-4 h-4" /> Neuer Beitrag
      </button>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
              <h2 className="font-bold text-gray-900 text-lg">Neuer Beitrag</h2>
              <button onClick={reset}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2 uppercase">Kategorie</p>
                <div className="flex gap-2 flex-wrap">
                  {(defaultChannel === 'gemeinderat' ? GEMEINDERAT_TAGS : TAGS).map(tag => (
                    <button key={tag} onClick={() => setForm(f => ({ ...f, tag }))}
                      className={clsx('px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors',
                        form.tag === tag ? 'border-primary-500 bg-primary-50 text-primary-600' : 'border-gray-200 text-gray-500')}>
                      {TAG_LABELS[tag]}
                    </button>
                  ))}
                </div>
              </div>
              <input type="text" placeholder="Titel" value={form.titel}
                onChange={e => setForm(f => ({ ...f, titel: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 font-bold" />
              <RichTextEditor
                value={form.inhalt}
                onChange={v => setForm(f => ({ ...f, inhalt: v }))}
                placeholder="Inhalt"
                rows={5}
              />
              <BilderUpload id="post-bilder" previews={bildPreviews} onAdd={addBilder} onRemove={removeBild} />
              {bildPreviews.length > 0 && (
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
              {form.tag === 'veranstaltung' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input type="date" value={form.veranstaltung_datum}
                      onChange={e => setForm(f => ({ ...f, veranstaltung_datum: e.target.value }))}
                      className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    <input type="time" value={form.veranstaltung_uhrzeit}
                      onChange={e => setForm(f => ({ ...f, veranstaltung_uhrzeit: e.target.value }))}
                      className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                  <input type="text" placeholder="Ort (z.B. Gemeindehaus, Hauptstraße 1)" value={form.veranstaltung_ort}
                    onChange={e => setForm(f => ({ ...f, veranstaltung_ort: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              )}
              {canPin && (
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={form.pinned} onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))} className="rounded" />
                  Beitrag anpinnen
                </label>
              )}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <label className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 cursor-pointer bg-gray-50">
                  <input type="checkbox" checked={form.geplant}
                    onChange={e => setForm(f => ({ ...f, geplant: e.target.checked, scheduled_date: '', scheduled_time: '' }))}
                    className="rounded" />
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="font-medium">Zeitgesteuert veröffentlichen</span>
                </label>
                {form.geplant && (
                  <div className="grid grid-cols-2 gap-3 p-3 border-t border-gray-200 bg-white">
                    <input type="date" value={form.scheduled_date}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))}
                      className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    <input type="time" value={form.scheduled_time}
                      onChange={e => setForm(f => ({ ...f, scheduled_time: e.target.value }))}
                      className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                )}
              </div>
              {canPush && (
                <label className="flex items-center gap-2 text-sm font-bold text-red-700 cursor-pointer bg-red-50 px-3 py-2.5 rounded-xl border border-red-200">
                  <input type="checkbox" checked={form.push} onChange={e => setForm(f => ({ ...f, push: e.target.checked }))} className="rounded accent-red-600" />
                  🔔 Push-Benachrichtigung senden (alle Nutzer)
                </label>
              )}
              {form.channel === 'gemeinderat' && (
                <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2.5 rounded-xl border border-amber-200">
                  ⏳ Dein Beitrag wird erst nach Freigabe durch die Verwaltung veröffentlicht.
                </p>
              )}
              <button onClick={submit} disabled={loading || !form.titel || !form.inhalt || (form.geplant && !form.scheduled_date) || (bildPreviews.length > 0 && !bildrechteBestaetigt)}
                className="w-full bg-primary-500 text-white font-bold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {form.channel === 'gemeinderat' ? 'Zur Freigabe einreichen' : 'Veröffentlichen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
