'use client'


import { toast } from 'sonner'
import { useState } from 'react'
import { Plus, Clock, CheckCircle2, XCircle, Loader2, X, Pencil, Trash2, CalendarClock } from 'lucide-react'
import { RichTextEditor } from '@/lib/richText'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/compressImage'
import { clsx } from 'clsx'
import BilderUpload from './BilderUpload'
import { VereinProfilForm, AbonnentenStats } from '@/features/verein'
import type { Verein, VereinKategorie } from '@/types/database'

interface Post {
  id: string
  titel: string
  inhalt: string
  status: string
  created_at: string
  tag: string | null
  bild_url?: string | null
  publish_at?: string | null
  rejection_reason?: string | null
}

interface Props {
  posts: Post[]
  gemeindeId: string
  profileId: string
  vereinName: string | null
  role?: 'verein' | 'organisation'
  vereinProfil?: Verein | null
  kategorien?: VereinKategorie[]
  abonnentenStats?: { gesamt: number; letzter7Tage: number; letzter30Tage: number } | null
}

const STATUS_META = {
  pending:   { label: 'Ausstehend',     color: 'bg-amber-100 text-amber-700',      icon: Clock },
  published: { label: 'Veröffentlicht', color: 'bg-primary-100 text-primary-700',  icon: CheckCircle2 },
  rejected:  { label: 'Abgelehnt',      color: 'bg-red-100 text-red-700',          icon: XCircle },
}

const TAGS = ['nachricht', 'veranstaltung', 'bekanntmachung'] as const

type FormState = { titel: string; inhalt: string; tag: string; veranstaltung_datum: string; veranstaltung_uhrzeit: string; veranstaltung_ort: string; geplant: boolean; scheduled_date: string; scheduled_time: string }

const emptyForm: FormState = { titel: '', inhalt: '', tag: 'nachricht', veranstaltung_datum: '', veranstaltung_uhrzeit: '', veranstaltung_ort: '', geplant: false, scheduled_date: '', scheduled_time: '' }

export default function VereinPostVerwaltung({ posts: initialPosts, gemeindeId, profileId, vereinName, role, vereinProfil: initialVereinProfil, kategorien = [], abonnentenStats }: Props) {
  const [vereinProfil, setVereinProfil] = useState(initialVereinProfil ?? null)
  const [showProfilForm, setShowProfilForm] = useState(false)
  const [posts, setPosts] = useState(initialPosts)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [bildFiles, setBildFiles] = useState<File[]>([])
  const [bildPreviews, setBildPreviews] = useState<string[]>([])
  const [bildrechteBestaetigt, setBildrechteBestaetigt] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const supabase = createClient()

  const accentColor = role === 'organisation' ? 'teal' : 'violet'

  const emptyVereinProfil: Verein = {
    id: '', profile_id: profileId, gemeinde_id: gemeindeId,
    verein_name: vereinName ?? '', typ: role ?? 'verein',
    kategorie_id: null, beschreibung: null, website: null,
    logo_url: null, verified: false, created_at: new Date().toISOString(),
  }

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
    setBildFiles([]); setBildPreviews([]); setBildrechteBestaetigt(false)
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
    setBildFiles([]); setBildrechteBestaetigt(false)
    setBildPreviews(post.bild_url ? [post.bild_url] : [])
  }

  function closeForm() {
    setShowNewForm(false)
    setEditingId(null)
    setForm(emptyForm)
    setBildFiles([]); setBildPreviews([]); setBildrechteBestaetigt(false)
  }

  async function deletePost(id: string, titel: string) {
    if (!confirm(`"${titel}" wirklich löschen?`)) return
    setDeleting(id)
    try {
      const res = await fetch('/api/verein/post', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: id }),
      })
      if (!res.ok) throw new Error()
      setPosts(prev => prev.filter(p => p.id !== id))
    } catch { toast.error('Fehler beim Löschen') }
    finally { setDeleting(null) }
  }

  async function submitNew() {
    if (!form.titel || !form.inhalt || !vereinProfil?.id) return
    setLoading(true)
    try {
      const bilderUrls = await uploadBilder()
      const bildUrl = bilderUrls[0] ?? null
      const publishAt = form.geplant && form.scheduled_date
        ? new Date(`${form.scheduled_date}T${form.scheduled_time || '08:00'}`).toISOString()
        : null
      const res = await fetch('/api/verein/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vereinId: vereinProfil.id,
          titel: form.titel,
          inhalt: form.inhalt,
          tag: form.tag,
          bildUrl,
          bilderUrls,
          publishAt,
          veranstaltungDatum: form.tag === 'veranstaltung' && form.veranstaltung_datum
            ? new Date(`${form.veranstaltung_datum}T${form.veranstaltung_uhrzeit || '00:00'}`).toISOString() : null,
          veranstaltungOrt: form.tag === 'veranstaltung' && form.veranstaltung_ort ? form.veranstaltung_ort : null,
        }),
      })
      const text = await res.text()
      let json: Record<string, unknown>
      try { json = JSON.parse(text) } catch { throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`) }
      if (!res.ok) throw new Error(json.error as string ?? 'Fehler')
      setPosts(prev => [json.post as Post, ...prev])
      closeForm()
    } catch (e: unknown) { toast.error('Fehler: ' + (e instanceof Error ? e.message : JSON.stringify(e))) }
    finally { setLoading(false) }
  }

  async function submitEdit() {
    if (!form.titel || !form.inhalt || !editingId) return
    setLoading(true)
    try {
      const bilderUrls = await uploadBilder()
      const bildUrl = bilderUrls.length > 0 ? bilderUrls[0] : (bildPreviews.length > 0 ? posts.find(p => p.id === editingId)?.bild_url ?? null : null)
      const publishAt = form.geplant && form.scheduled_date
        ? new Date(`${form.scheduled_date}T${form.scheduled_time || '08:00'}`).toISOString()
        : null
      const res = await fetch('/api/verein/post', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: editingId,
          titel: form.titel,
          inhalt: form.inhalt,
          tag: form.tag,
          bildUrl,
          ...(bilderUrls.length > 0 ? { bilderUrls } : {}),
          publishAt,
          veranstaltungDatum: form.tag === 'veranstaltung' && form.veranstaltung_datum
            ? new Date(`${form.veranstaltung_datum}T${form.veranstaltung_uhrzeit || '00:00'}`).toISOString() : null,
          veranstaltungOrt: form.tag === 'veranstaltung' && form.veranstaltung_ort ? form.veranstaltung_ort : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Fehler')
      setPosts(prev => prev.map(p => p.id === editingId ? { ...p, titel: form.titel, inhalt: form.inhalt, tag: form.tag, status: 'pending' } : p))
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
          <div className="flex items-center gap-2">
            {vereinProfil && (
              <button onClick={() => setShowProfilForm(v => !v)}
                className="flex items-center gap-2 bg-gray-100 text-gray-600 font-bold px-3 py-2 rounded-xl text-sm">
                <Pencil className="w-4 h-4" /> Profil
              </button>
            )}
            <button onClick={openNew} disabled={!vereinProfil}
              className="flex items-center gap-2 bg-primary-500 text-white font-bold px-4 py-2 rounded-xl text-sm disabled:opacity-40">
              <Plus className="w-4 h-4" /> Neuer Beitrag
            </button>
          </div>
        </div>
      </div>

      <div className="px-8 py-6">
        {/* Profil noch nicht angelegt */}
        {!vereinProfil && (
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
            <h2 className="font-bold text-gray-900 mb-1">Profil anlegen</h2>
            <p className="text-sm text-gray-500 mb-4">
              Bitte legen Sie zuerst Ihr {role === 'organisation' ? 'Organisations' : 'Vereins'}profil an.
            </p>
            <VereinProfilForm
              verein={emptyVereinProfil}
              kategorien={kategorien}
              onUpdated={updated => setVereinProfil(updated)}
            />
          </div>
        )}

        {/* Abonnenten-Stats */}
        {abonnentenStats && (
          <div className="mb-6">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Abonnenten</p>
            <AbonnentenStats {...abonnentenStats} color={accentColor} />
          </div>
        )}

        {/* Profil bearbeiten (aufklappbar via Header-Button) */}
        {vereinProfil && showProfilForm && (
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">Profil bearbeiten</h2>
              <button onClick={() => setShowProfilForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <VereinProfilForm
              verein={vereinProfil}
              kategorien={kategorien}
              onUpdated={updated => { setVereinProfil(updated); setShowProfilForm(false) }}
            />
          </div>
        )}
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
              <RichTextEditor
                value={form.inhalt}
                onChange={v => setForm(f => ({ ...f, inhalt: v }))}
                placeholder="Inhalt"
                rows={4}
              />
              <BilderUpload id="verein-bilder" previews={bildPreviews} onAdd={addBilder} onRemove={removeBild} />
              {bildFiles.length > 0 && (
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
                disabled={loading || !form.titel || !form.inhalt || (form.geplant && !form.scheduled_date) || (bildFiles.length > 0 && !bildrechteBestaetigt)}
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
                  {post.status === 'rejected' && post.rejection_reason && (
                    <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                      <span className="font-bold">Ablehnungsgrund: </span>{post.rejection_reason}
                    </div>
                  )}
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
