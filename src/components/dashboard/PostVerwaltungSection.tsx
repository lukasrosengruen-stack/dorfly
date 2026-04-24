'use client'

import { useState } from 'react'
import { Pencil, Trash2, Loader2, X, ImagePlus, Newspaper } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { clsx } from 'clsx'

const TAGS = ['nachricht', 'veranstaltung', 'bekanntmachung'] as const
const TAG_LABELS = { nachricht: 'Nachricht', veranstaltung: 'Veranstaltung', bekanntmachung: 'Bekanntmachung' }

interface Post {
  id: string
  titel: string
  inhalt: string
  channel: string
  tag: string | null
  pinned: boolean
  bild_url: string | null
  veranstaltung_datum: string | null
  veranstaltung_ort: string | null
  published_at: string
}

interface Props {
  posts: Post[]
}

type FormState = {
  titel: string
  inhalt: string
  tag: string
  channel: string
  veranstaltung_datum: string
  veranstaltung_uhrzeit: string
  veranstaltung_ort: string
  pinned: boolean
}

const CHANNEL_COLORS: Record<string, string> = {
  gemeinde: 'bg-primary-100 text-primary-600',
  verein: 'bg-violet-100 text-violet-700',
  gewerbe: 'bg-orange-100 text-orange-700',
}
const CHANNEL_LABELS: Record<string, string> = {
  gemeinde: 'Gemeinde', verein: 'Verein', gewerbe: 'Gewerbe',
}

export default function PostVerwaltungSection({ posts: initialPosts }: Props) {
  const [posts, setPosts] = useState(initialPosts)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [bildFile, setBildFile] = useState<File | null>(null)
  const [bildPreview, setBildPreview] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({ titel: '', inhalt: '', tag: 'nachricht', channel: 'gemeinde', veranstaltung_datum: '', veranstaltung_uhrzeit: '', veranstaltung_ort: '', pinned: false })
  const supabase = createClient()

  function openEdit(post: Post) {
    const datum = post.veranstaltung_datum ? new Date(post.veranstaltung_datum) : null
    setEditingId(post.id)
    setForm({
      titel: post.titel,
      inhalt: post.inhalt,
      tag: post.tag ?? 'nachricht',
      channel: post.channel,
      veranstaltung_datum: datum ? datum.toISOString().split('T')[0] : '',
      veranstaltung_uhrzeit: datum ? datum.toTimeString().slice(0, 5) : '',
      veranstaltung_ort: post.veranstaltung_ort ?? '',
      pinned: post.pinned,
    })
    setBildFile(null)
    setBildPreview(post.bild_url)
  }

  function closeEdit() {
    setEditingId(null)
    setBildFile(null)
    setBildPreview(null)
  }

  function handleBild(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBildFile(file)
    setBildPreview(URL.createObjectURL(file))
  }

  async function uploadBild(): Promise<string | null> {
    if (!bildFile) return null
    const ext = bildFile.name.split('.').pop()
    const path = `posts/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('dorfly-media').upload(path, bildFile)
    if (error) return null
    return supabase.storage.from('dorfly-media').getPublicUrl(path).data.publicUrl
  }

  async function submitEdit() {
    if (!editingId || !form.titel || !form.inhalt) return
    setLoading(true)
    try {
      const uploadedUrl = await uploadBild()
      const bild_url = uploadedUrl ?? (bildPreview ? posts.find(p => p.id === editingId)?.bild_url ?? null : null)
      const veranstaltung_datum = form.tag === 'veranstaltung' && form.veranstaltung_datum
        ? new Date(`${form.veranstaltung_datum}T${form.veranstaltung_uhrzeit || '00:00'}`).toISOString() : null
      const res = await fetch('/api/posts/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          titel: form.titel, inhalt: form.inhalt, tag: form.tag, channel: form.channel,
          pinned: form.pinned, bild_url, veranstaltung_datum,
          veranstaltung_ort: form.tag === 'veranstaltung' && form.veranstaltung_ort ? form.veranstaltung_ort : null,
        }),
      })
      if (!res.ok) throw new Error()
      setPosts(prev => prev.map(p => p.id === editingId ? { ...p, ...form, bild_url, veranstaltung_datum } : p))
      closeEdit()
    } catch { alert('Fehler beim Speichern') }
    finally { setLoading(false) }
  }

  async function deletePost(id: string, titel: string) {
    if (!confirm(`"${titel}" wirklich löschen?`)) return
    setDeleting(id)
    try {
      const res = await fetch('/api/posts/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error()
      setPosts(prev => prev.filter(p => p.id !== id))
    } catch { alert('Fehler beim Löschen') }
    finally { setDeleting(null) }
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="font-bold text-gray-900 flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-primary-500" />
          Beiträge verwalten
        </h2>
        <span className="text-xs text-gray-400">{posts.length} Beiträge</span>
      </div>

      {/* Edit-Formular */}
      {editingId && (
        <div className="p-5 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">Beitrag bearbeiten</h3>
            <button onClick={closeEdit}><X className="w-5 h-5 text-gray-400" /></button>
          </div>
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              {TAGS.map(tag => (
                <button key={tag} onClick={() => setForm(f => ({ ...f, tag }))}
                  className={clsx('px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors',
                    form.tag === tag ? 'border-primary-500 bg-primary-50 text-primary-600' : 'border-gray-200 text-gray-500')}>
                  {TAG_LABELS[tag]}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {(['gemeinde', 'verein', 'gewerbe'] as const).map(ch => (
                <button key={ch} onClick={() => setForm(f => ({ ...f, channel: ch }))}
                  className={clsx('px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors capitalize',
                    form.channel === ch ? 'border-primary-500 bg-primary-50 text-primary-600' : 'border-gray-200 text-gray-500')}>
                  {CHANNEL_LABELS[ch]}
                </button>
              ))}
            </div>
            <input type="text" placeholder="Titel" value={form.titel}
              onChange={e => setForm(f => ({ ...f, titel: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 font-bold" />
            <textarea placeholder="Inhalt" value={form.inhalt} rows={4}
              onChange={e => setForm(f => ({ ...f, inhalt: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <input type="file" accept="image/*" id="verwaltung-edit-bild" className="hidden" onChange={handleBild} />
            <button onClick={() => document.getElementById('verwaltung-edit-bild')?.click()}
              className={clsx('w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-bold',
                bildFile ? 'border-primary-500 text-primary-600 bg-primary-50' : 'border-gray-300 text-gray-500')}>
              <ImagePlus className="w-4 h-4" />
              {bildFile ? bildFile.name : 'Bild ändern'}
            </button>
            {bildPreview && (
              <div className="relative">
                <img src={bildPreview} className="w-full h-40 object-cover rounded-xl" alt="" />
                <button onClick={() => { setBildFile(null); setBildPreview(null) }}
                  className="absolute top-2 right-2 bg-black/60 rounded-full p-1">
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
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
                <input type="text" placeholder="Ort" value={form.veranstaltung_ort}
                  onChange={e => setForm(f => ({ ...f, veranstaltung_ort: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.pinned} onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))} className="rounded" />
              Beitrag anpinnen
            </label>
            <button onClick={submitEdit} disabled={loading || !form.titel || !form.inhalt}
              className="w-full bg-primary-500 text-white font-bold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Änderungen speichern
            </button>
          </div>
        </div>
      )}

      <div className="divide-y divide-gray-50">
        {posts.length === 0 && (
          <p className="px-5 py-6 text-center text-gray-400 text-sm">Noch keine Beiträge</p>
        )}
        {posts.map(p => (
          <div key={p.id} className="px-5 py-3 flex items-center gap-3">
            <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 font-medium ${CHANNEL_COLORS[p.channel] ?? 'bg-gray-100 text-gray-600'}`}>
              {CHANNEL_LABELS[p.channel] ?? p.channel}
            </span>
            <span className="text-sm text-gray-800 truncate flex-1">{p.titel}</span>
            <span className="text-xs text-gray-400 shrink-0">
              {new Date(p.published_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
            </span>
            <button onClick={() => openEdit(p)}
              className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors shrink-0">
              <Pencil className="w-3.5 h-3.5 text-gray-500" />
            </button>
            <button onClick={() => deletePost(p.id, p.titel)} disabled={deleting === p.id}
              className="p-1.5 rounded-lg bg-gray-100 hover:bg-red-100 transition-colors shrink-0 disabled:opacity-50">
              {deleting === p.id
                ? <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                : <Trash2 className="w-3.5 h-3.5 text-gray-500" />}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
