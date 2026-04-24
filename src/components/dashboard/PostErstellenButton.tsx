'use client'

import { useState } from 'react'
import { Plus, X, Loader2, ImagePlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { clsx } from 'clsx'

const TAGS = ['nachricht', 'veranstaltung', 'bekanntmachung'] as const
const TAG_LABELS = { nachricht: 'Nachricht', veranstaltung: 'Veranstaltung', bekanntmachung: 'Bekanntmachung' }

interface Props {
  gemeindeId: string
  profileId: string
}

export default function PostErstellenButton({ gemeindeId, profileId }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [bildFile, setBildFile] = useState<File | null>(null)
  const [bildPreview, setBildPreview] = useState<string | null>(null)
  const [form, setForm] = useState({ titel: '', inhalt: '', tag: 'nachricht' as typeof TAGS[number], channel: 'gemeinde' as 'gemeinde' | 'verein' | 'gewerbe', veranstaltung_datum: '', veranstaltung_uhrzeit: '', pinned: false })
  const supabase = createClient()

  function handleBild(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBildFile(file)
    setBildPreview(URL.createObjectURL(file))
  }

  async function submit() {
    if (!form.titel || !form.inhalt) return
    setLoading(true)
    try {
      let bild_url: string | null = null
      if (bildFile) {
        const ext = bildFile.name.split('.').pop()
        const path = `posts/${Date.now()}.${ext}`
        const { error } = await supabase.storage.from('dorfly-media').upload(path, bildFile)
        if (!error) bild_url = supabase.storage.from('dorfly-media').getPublicUrl(path).data.publicUrl
      }
      const { error } = await supabase.from('posts').insert({
        gemeinde_id: gemeindeId, author_id: profileId,
        channel: form.channel, titel: form.titel, inhalt: form.inhalt,
        tag: form.tag, status: 'published', pinned: form.pinned, bild_url,
        veranstaltung_datum: form.tag === 'veranstaltung' && form.veranstaltung_datum
          ? new Date(`${form.veranstaltung_datum}T${form.veranstaltung_uhrzeit || '00:00'}`).toISOString() : null,
      })
      if (error) throw error
      setShowForm(false)
      setForm({ titel: '', inhalt: '', tag: 'nachricht', channel: 'gemeinde', veranstaltung_datum: '', veranstaltung_uhrzeit: '', pinned: false })
      setBildFile(null); setBildPreview(null)
      window.location.reload()
    } catch {
      alert('Fehler beim Erstellen')
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
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2 uppercase">Kategorie</p>
                <div className="flex gap-2 flex-wrap">
                  {TAGS.map(tag => (
                    <button key={tag} onClick={() => setForm(f => ({ ...f, tag }))}
                      className={clsx('px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors',
                        form.tag === tag ? 'border-primary-500 bg-primary-50 text-primary-600' : 'border-gray-200 text-gray-500')}>
                      {TAG_LABELS[tag]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2 uppercase">Kanal</p>
                <div className="flex gap-2">
                  {(['gemeinde', 'verein', 'gewerbe'] as const).map(ch => (
                    <button key={ch} onClick={() => setForm(f => ({ ...f, channel: ch }))}
                      className={clsx('px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors capitalize',
                        form.channel === ch ? 'border-primary-500 bg-primary-50 text-primary-600' : 'border-gray-200 text-gray-500')}>
                      {ch.charAt(0).toUpperCase() + ch.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <input type="text" placeholder="Titel" value={form.titel}
                onChange={e => setForm(f => ({ ...f, titel: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 font-bold" />
              <textarea placeholder="Inhalt" value={form.inhalt} rows={5}
                onChange={e => setForm(f => ({ ...f, inhalt: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <input type="file" accept="image/*" id="post-bild" className="hidden" onChange={handleBild} />
              <button onClick={() => document.getElementById('post-bild')?.click()}
                className={clsx('w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-bold',
                  bildFile ? 'border-primary-500 text-primary-600 bg-primary-50' : 'border-gray-300 text-gray-500')}>
                <ImagePlus className="w-4 h-4" />
                {bildFile ? bildFile.name : 'Bild hinzufügen'}
              </button>
              {bildPreview && <img src={bildPreview} className="w-full h-40 object-cover rounded-xl" alt="" />}
              {form.tag === 'veranstaltung' && (
                <div className="grid grid-cols-2 gap-3">
                  <input type="date" value={form.veranstaltung_datum}
                    onChange={e => setForm(f => ({ ...f, veranstaltung_datum: e.target.value }))}
                    className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  <input type="time" value={form.veranstaltung_uhrzeit}
                    onChange={e => setForm(f => ({ ...f, veranstaltung_uhrzeit: e.target.value }))}
                    className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form.pinned} onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))}
                  className="rounded" />
                Beitrag anpinnen
              </label>
              <button onClick={submit} disabled={loading || !form.titel || !form.inhalt}
                className="w-full bg-primary-500 text-white font-bold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Veröffentlichen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
