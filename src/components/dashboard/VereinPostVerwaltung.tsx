'use client'


import { toast } from 'sonner'
import { useState, useRef } from 'react'
import { Plus, Clock, CheckCircle2, XCircle, Loader2, X, Pencil, Trash2, CalendarClock } from 'lucide-react'
import { BoldButton } from '@/lib/richText'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/compressImage'
import { clsx } from 'clsx'
import BilderUpload from './BilderUpload'

interface Post {
  id: string
  titel: string
  inhalt: string
  status: string
  created_at: string
  tag: string | null
  bild_url?: string | null
  publish_at?: string | null
}

interface Props {
  posts: Post[]
  gemeindeId: string
  profileId: string
  vereinName: string | null
  channel: 'verein' | 'gewerbe'
  role?: 'verein' | 'organisation'
}

const STATUS_META = {
  pending:   { label: 'Ausstehend',     color: 'bg-amber-100 text-amber-700',      icon: Clock },
  published: { label: 'Veröffentlicht', color: 'bg-primary-100 text-primary-700',  icon: CheckCircle2 },
  rejected:  { label: 'Abgelehnt',      color: 'bg-red-100 text-red-700',          icon: XCircle },
}

const TAGS = ['nachricht', 'veranstaltung', 'bekanntmachung'] as const

type FormState = { titel: string; inhalt: string; tag: string; veranstaltung_datum: string; veranstaltung_uhrzeit: string; veranstaltung_ort: string; geplant: boolean; scheduled_date: string; scheduled_time: string }

const emptyForm: FormState = { titel: '', inhalt: '', tag: 'nachricht', veranstaltung_datum: '', veranstaltung_uhrzeit: '', veranstaltung_ort: '', geplant: false, scheduled_date: '', scheduled_time: '' }

export default function VereinPostVerwaltung({ posts: initialPosts, gemeindeId, profileId, vereinName, channel, role }: Props) {
  const inhaltRef = useRef<HTMLTextAreaElement>(null)
  const [posts, setPosts] = useState(initialPosts)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [bildFiles, setBildFiles] = useState<File[]>([])
  const [bildPreviews, setBildPreviews] = useState<string[]>([])
  const [form, setForm] = useState<FormState>(emptyForm)
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

  function openNew() {
    setEditingId(null)
    setForm(emptyForm)
    setBildFiles([]); setBildPreviews([])
    setShowNewForm(true)
  }

  function openEdit(post: Post) {
    setShowNewForm(false)
    setEditingId(post.id)
    const hasFutureSchedule = !!post.publish_at && new Date(post.publish_at) > new Date()
    setForm({
      titel: post.titel, inhalt: post.inhalt, tag: post.tag ?? 'nachricht',
      veranstaltung_datum: '', veranstaltung_uhrzeit: '', veranstaltung_ort: '',
      geplant: hasFutureSchedule,
      scheduled_date: hasFutureSchedule ? post.publish_at!.split('T')[0] : '',
      scheduled_time: hasFutureSchedule ? (post.publish_at!.split('T')[1]?.slice(0, 5) ?? '') : '',
    })
    setBildFiles([])
    setBildPreviews(post.bild_url ? [post.bild_url] : [])
  }

  function closeForm() {
    setShowNewForm(false)
    setEditingId(null)
    setForm(emptyForm)
    setBildFiles([]); setBildPreviews([])
  }

  async function deletePost(id: string, titel: string) {
    if (!confirm(`"${titel}" wirklich löschen?`)) return
    setDeleting(id)
    try {
      const { error } = await supabase.from('posts').delete().eq('id', id)
      if (error) throw error
      setPosts(prev => prev.filter(p => p.id !== id))
    } catch { toast.error('Fehler beim Löschen') }
    finally { setDeleting(null) }
  }

  async function submitNew() {
    if (!form.titel || !form.inhalt) return
    setLoading(true)
    try {
      const bilder_urls = await uploadBilder()
      const bild_url = bilder_urls[0] ?? null
      const publishAt = form.geplant && form.scheduled_date
        ? new Date(`${form.scheduled_date}T${form.scheduled_time || '08:00'}`).toISOString()
        : null
      const { data, error } = await supabase.from('posts').insert({
        gemeinde_id: gemeindeId, author_id: profileId,
        channel, titel: form.titel, inhalt: form.inhalt,
        tag: form.tag, status: 'pending', bild_url, bilder_urls,
        publish_at: publishAt,
        veranstaltung_datum: form.tag === 'veranstaltung' && form.veranstaltung_datum
          ? new Date(`${form.veranstaltung_datum}T${form.veranstaltung_uhrzeit || '00:00'}`).toISOString() : null,
        veranstaltung_ort: form.tag === 'veranstaltung' && form.veranstaltung_ort ? form.veranstaltung_ort : null,
      }).select('id, titel, inhalt, status, created_at, tag, bild_url, publish_at').single()
      if (error) throw error
      setPosts(prev => [data as Post, ...prev])
      closeForm()
    } catch { toast.error('Fehler beim Einreichen') }
    finally { setLoading(false) }
  }

  async function submitEdit() {
    if (!form.titel || !form.inhalt || !editingId) return
    setLoading(true)
    try {
      const bilder_urls = await uploadBilder()
      const bild_url = bilder_urls.length > 0 ? bilder_urls[0] : (bildPreviews.length > 0 ? posts.find(p => p.id === editingId)?.bild_url ?? null : null)
      const publishAt = form.geplant && form.scheduled_date
        ? new Date(`${form.scheduled_date}T${form.scheduled_time || '08:00'}`).toISOString()
        : null
      const { error } = await supabase.from('posts').update({
        titel: form.titel, inhalt: form.inhalt, tag: form.tag,
        status: 'pending', bild_url, bilder_urls: bilder_urls.length > 0 ? bilder_urls : undefined,
        publish_at: publishAt,
        veranstaltung_datum: form.tag === 'veranstaltung' && form.veranstaltung_datum
          ? new Date(`${form.veranstaltung_datum}T${form.veranstaltung_uhrzeit || '00:00'}`).toISOString() : null,
        veranstaltung_ort: form.tag === 'veranstaltung' && form.veranstaltung_ort ? form.veranstaltung_ort : null,
      }).eq('id', editingId)
      if (error) throw error
      setPosts(prev => prev.map(p => p.id === editingId ? { ...p, ...form, status: 'pending' } : p))
      closeForm()
    } catch (e: unknown) { toast.error('Fehler beim Speichern: ' + (e instanceof Error ? e.message : JSON.stringify(e))) }
    finally { setLoading(false) }
  }

  const isEditing = !!editingId
  const showForm = showNewForm || isEditing

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 pt-8 pb-5">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-0.5">{role === 'organisation' ? 'Organisationsbereich' : 'Vereinsbereich'}</p>
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
              <div>
                <div className="flex gap-1 mb-1">
                  <BoldButton textareaRef={inhaltRef} value={form.inhalt} onChange={v => setForm(f => ({ ...f, inhalt: v }))} />
                </div>
                <textarea ref={inhaltRef} placeholder="Inhalt" value={form.inhalt} rows={4}
                  onChange={e => setForm(f => ({ ...f, inhalt: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <BilderUpload id="verein-bilder" previews={bildPreviews} onAdd={addBilder} onRemove={removeBild} />
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
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <label className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 cursor-pointer bg-gray-50">
                  <input type="checkbox" checked={form.geplant}
                    onChange={e => setForm(f => ({ ...f, geplant: e.target.checked, scheduled_date: '', scheduled_time: '' }))}
                    className="rounded" />
                  <CalendarClock className="w-4 h-4 text-gray-400" />
                  <span className="font-medium">Erscheinungszeitpunkt festlegen</span>
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
              {isEditing && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
                  Nach der Bearbeitung wird der Beitrag erneut zur Prüfung eingereicht.
                </p>
              )}
              <button onClick={isEditing ? submitEdit : submitNew}
                disabled={loading || !form.titel || !form.inhalt || (form.geplant && !form.scheduled_date)}
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
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <p className="text-xs text-gray-400">
                      {new Date(post.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </p>
                    {post.publish_at && new Date(post.publish_at) > new Date() && (
                      <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                        <CalendarClock className="w-3 h-3" />
                        {new Date(post.publish_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} Uhr
                      </span>
                    )}
                  </div>
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
