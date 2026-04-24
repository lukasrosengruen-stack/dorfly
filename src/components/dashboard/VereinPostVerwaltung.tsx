'use client'

import { useState } from 'react'
import { Plus, Clock, CheckCircle2, XCircle, Loader2, X, ImagePlus, Pencil, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { clsx } from 'clsx'

interface Post {
  id: string
  titel: string
  inhalt: string
  status: string
  created_at: string
  tag: string | null
  bild_url?: string | null
}

interface Props {
  posts: Post[]
  gemeindeId: string
  profileId: string
  vereinName: string | null
}

const STATUS_META = {
  pending:   { label: 'Ausstehend',     color: 'bg-amber-100 text-amber-700',      icon: Clock },
  published: { label: 'Veröffentlicht', color: 'bg-primary-100 text-primary-700',  icon: CheckCircle2 },
  rejected:  { label: 'Abgelehnt',      color: 'bg-red-100 text-red-700',          icon: XCircle },
}

const TAGS = ['nachricht', 'veranstaltung', 'bekanntmachung'] as const

type FormState = { titel: string; inhalt: string; tag: string; veranstaltung_datum: string; veranstaltung_uhrzeit: string; veranstaltung_ort: string }

const emptyForm: FormState = { titel: '', inhalt: '', tag: 'nachricht', veranstaltung_datum: '', veranstaltung_uhrzeit: '', veranstaltung_ort: '' }

export default function VereinPostVerwaltung({ posts: initialPosts, gemeindeId, profileId, vereinName }: Props) {
  const [posts, setPosts] = useState(initialPosts)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [bildFile, setBildFile] = useState<File | null>(null)
  const [bildPreview, setBildPreview] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const supabase = createClient()

  function openNew() {
    setEditingId(null)
    setForm(emptyForm)
    setBildFile(null); setBildPreview(null)
    setShowNewForm(true)
  }

  function openEdit(post: Post) {
    setShowNewForm(false)
    setEditingId(post.id)
    setForm({ titel: post.titel, inhalt: post.inhalt, tag: post.tag ?? 'nachricht', veranstaltung_datum: '', veranstaltung_uhrzeit: '', veranstaltung_ort: '' })
    setBildFile(null)
    setBildPreview(post.bild_url ?? null)
  }

  function closeForm() {
    setShowNewForm(false)
    setEditingId(null)
    setForm(emptyForm)
    setBildFile(null); setBildPreview(null)
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

  async function deletePost(id: string, titel: string) {
    if (!confirm(`"${titel}" wirklich löschen?`)) return
    setDeleting(id)
    try {
      const { error } = await supabase.from('posts').delete().eq('id', id)
      if (error) throw error
      setPosts(prev => prev.filter(p => p.id !== id))
    } catch { alert('Fehler beim Löschen') }
    finally { setDeleting(null) }
  }

  async function submitNew() {
    if (!form.titel || !form.inhalt) return
    setLoading(true)
    try {
      const bild_url = await uploadBild()
      const { data, error } = await supabase.from('posts').insert({
        gemeinde_id: gemeindeId, author_id: profileId,
        channel: 'verein', titel: form.titel, inhalt: form.inhalt,
        tag: form.tag, status: 'pending', bild_url,
        veranstaltung_datum: form.tag === 'veranstaltung' && form.veranstaltung_datum
          ? new Date(`${form.veranstaltung_datum}T${form.veranstaltung_uhrzeit || '00:00'}`).toISOString() : null,
        veranstaltung_ort: form.tag === 'veranstaltung' && form.veranstaltung_ort ? form.veranstaltung_ort : null,
      }).select('id, titel, inhalt, status, created_at, tag, bild_url').single()
      if (error) throw error
      setPosts(prev => [data as Post, ...prev])
      closeForm()
    } catch { alert('Fehler beim Einreichen') }
    finally { setLoading(false) }
  }

  async function submitEdit() {
    if (!form.titel || !form.inhalt || !editingId) return
    setLoading(true)
    try {
      const uploadedUrl = await uploadBild()
      const bild_url = uploadedUrl ?? (bildPreview ? posts.find(p => p.id === editingId)?.bild_url ?? null : null)
      const { error } = await supabase.from('posts').update({
        titel: form.titel, inhalt: form.inhalt, tag: form.tag,
        status: 'pending', bild_url,
        veranstaltung_datum: form.tag === 'veranstaltung' && form.veranstaltung_datum
          ? new Date(`${form.veranstaltung_datum}T${form.veranstaltung_uhrzeit || '00:00'}`).toISOString() : null,
        veranstaltung_ort: form.tag === 'veranstaltung' && form.veranstaltung_ort ? form.veranstaltung_ort : null,
      }).eq('id', editingId)
      if (error) throw error
      setPosts(prev => prev.map(p => p.id === editingId ? { ...p, ...form, status: 'pending' } : p))
      closeForm()
    } catch { alert('Fehler beim Speichern') }
    finally { setLoading(false) }
  }

  const isEditing = !!editingId
  const showForm = showNewForm || isEditing

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 pt-8 pb-5">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-0.5">Vereinsbereich</p>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{vereinName ?? 'Meine Beiträge'}</h1>
          <button onClick={openNew}
            className="flex items-center gap-2 bg-primary-500 text-white font-bold px-4 py-2 rounded-xl text-sm">
            <Plus className="w-4 h-4" /> Neuer Beitrag
          </button>
        </div>
      </div>

      <div className="px-8 py-6">
        {/* Formular */}
        {showForm && (
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">
                {isEditing ? 'Beitrag bearbeiten' : 'Neuen Beitrag einreichen'}
              </h2>
              <button onClick={closeForm}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                {TAGS.map(tag => (
                  <button key={tag} onClick={() => setForm(f => ({ ...f, tag }))}
                    className={clsx('px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors',
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
              <input type="file" accept="image/*" id="verein-bild" className="hidden" onChange={handleBild} />
              <button onClick={() => document.getElementById('verein-bild')?.click()}
                className={clsx('w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-bold',
                  bildFile ? 'border-primary-500 text-primary-600 bg-primary-50' : 'border-gray-300 text-gray-500')}>
                <ImagePlus className="w-4 h-4" />
                {bildFile ? bildFile.name : 'Bild hinzufügen'}
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
                  <input type="text" placeholder="Ort (z.B. Gemeindehaus, Hauptstraße 1)" value={form.veranstaltung_ort}
                    onChange={e => setForm(f => ({ ...f, veranstaltung_ort: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              )}
              {isEditing && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
                  Nach der Bearbeitung wird der Beitrag erneut zur Prüfung eingereicht.
                </p>
              )}
              <button onClick={isEditing ? submitEdit : submitNew}
                disabled={loading || !form.titel || !form.inhalt}
                className="w-full bg-primary-500 text-white font-bold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {isEditing ? 'Änderungen einreichen' : 'Zur Prüfung einreichen'}
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
            const canEdit = post.status === 'published' || post.status === 'rejected'
            return (
              <div key={post.id} className="bg-white rounded-2xl shadow-sm p-5 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{post.titel}</p>
                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{post.inhalt}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(post.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={clsx('flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full', meta.color)}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {meta.label}
                  </span>
                  {canEdit && (
                    <button onClick={() => openEdit(post)}
                      className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">
                      <Pencil className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                  )}
                  <button onClick={() => deletePost(post.id, post.titel)}
                    disabled={deleting === post.id}
                    className="p-1.5 rounded-lg bg-gray-100 hover:bg-red-100 transition-colors disabled:opacity-50">
                    {deleting === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" /> : <Trash2 className="w-3.5 h-3.5 text-gray-500 hover:text-red-500" />}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
