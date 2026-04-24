'use client'

import { useState } from 'react'
import { Plus, Clock, CheckCircle2, XCircle, Loader2, X, ImagePlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { clsx } from 'clsx'

interface Post {
  id: string
  titel: string
  inhalt: string
  status: string
  created_at: string
  tag: string | null
}

interface Props {
  posts: Post[]
  gemeindeId: string
  profileId: string
  vereinName: string | null
}

const STATUS_META = {
  pending:   { label: 'Ausstehend',    color: 'bg-amber-100 text-amber-700',   icon: Clock },
  published: { label: 'Veröffentlicht', color: 'bg-primary-100 text-primary-700', icon: CheckCircle2 },
  rejected:  { label: 'Abgelehnt',     color: 'bg-red-100 text-red-700',       icon: XCircle },
}

export default function VereinPostVerwaltung({ posts: initialPosts, gemeindeId, profileId, vereinName }: Props) {
  const [posts, setPosts] = useState(initialPosts)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [bildFile, setBildFile] = useState<File | null>(null)
  const [bildPreview, setBildPreview] = useState<string | null>(null)
  const [form, setForm] = useState({ titel: '', inhalt: '', tag: 'nachricht', veranstaltung_datum: '', veranstaltung_uhrzeit: '' })
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
        const { error: uploadErr } = await supabase.storage.from('dorfly-media').upload(path, bildFile)
        if (!uploadErr) bild_url = supabase.storage.from('dorfly-media').getPublicUrl(path).data.publicUrl
      }

      const { data, error } = await supabase.from('posts').insert({
        gemeinde_id: gemeindeId,
        author_id: profileId,
        channel: 'verein',
        titel: form.titel,
        inhalt: form.inhalt,
        tag: form.tag,
        status: 'pending',
        bild_url,
        veranstaltung_datum: form.tag === 'veranstaltung' && form.veranstaltung_datum
          ? new Date(`${form.veranstaltung_datum}T${form.veranstaltung_uhrzeit || '00:00'}`).toISOString() : null,
      }).select('id, titel, inhalt, status, created_at, tag').single()

      if (error) throw error
      setPosts(prev => [data as Post, ...prev])
      setForm({ titel: '', inhalt: '', tag: 'nachricht', veranstaltung_datum: '', veranstaltung_uhrzeit: '' })
      setBildFile(null); setBildPreview(null)
      setShowForm(false)
    } catch {
      alert('Fehler beim Einreichen')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 pt-8 pb-5">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-0.5">Vereinsbereich</p>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{vereinName ?? 'Meine Beiträge'}</h1>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-primary-500 text-white font-bold px-4 py-2 rounded-xl text-sm"
          >
            <Plus className="w-4 h-4" />
            Neuer Beitrag
          </button>
        </div>
      </div>

      <div className="px-8 py-6">
        {/* Formular */}
        {showForm && (
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">Neuen Beitrag einreichen</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                {(['nachricht', 'veranstaltung', 'bekanntmachung'] as const).map(tag => (
                  <button key={tag} onClick={() => setForm(f => ({ ...f, tag }))}
                    className={clsx('px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors capitalize',
                      form.tag === tag ? 'border-primary-500 bg-primary-50 text-primary-600' : 'border-gray-200 text-gray-500')}>
                    {tag.charAt(0).toUpperCase() + tag.slice(1)}
                  </button>
                ))}
              </div>
              <input type="text" placeholder="Titel" value={form.titel}
                onChange={e => setForm(f => ({ ...f, titel: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 font-bold" />
              <textarea placeholder="Inhalt" value={form.inhalt} rows={4}
                onChange={e => setForm(f => ({ ...f, inhalt: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <input type="file" accept="image/*" id="bild-input" className="hidden" onChange={handleBild} />
              <button onClick={() => document.getElementById('bild-input')?.click()}
                className={clsx('w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-bold transition-colors',
                  bildFile ? 'border-primary-500 text-primary-600 bg-primary-50' : 'border-gray-300 text-gray-500')}>
                <ImagePlus className="w-4 h-4" />
                {bildFile ? bildFile.name : 'Bild hinzufügen'}
              </button>
              {bildPreview && (
                <div className="relative">
                  <img src={bildPreview} alt="Vorschau" className="w-full h-40 object-cover rounded-xl" />
                  <button onClick={() => { setBildFile(null); setBildPreview(null) }}
                    className="absolute top-2 right-2 bg-black/60 rounded-full p-1">
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              )}
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
              <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
                Dein Beitrag wird nach der Prüfung durch die Verwaltung veröffentlicht.
              </p>
              <button onClick={submit} disabled={loading || !form.titel || !form.inhalt}
                className="w-full bg-primary-500 text-white font-bold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Zur Prüfung einreichen
              </button>
            </div>
          </div>
        )}

        {/* Beiträge Liste */}
        <div className="space-y-3">
          {posts.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-400">
              <p className="font-medium">Noch keine Beiträge eingereicht</p>
            </div>
          )}
          {posts.map(post => {
            const meta = STATUS_META[post.status as keyof typeof STATUS_META] ?? STATUS_META.pending
            const StatusIcon = meta.icon
            return (
              <div key={post.id} className="bg-white rounded-2xl shadow-sm p-5 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{post.titel}</p>
                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{post.inhalt}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(post.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </p>
                </div>
                <span className={clsx('flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full shrink-0', meta.color)}>
                  <StatusIcon className="w-3.5 h-3.5" />
                  {meta.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
