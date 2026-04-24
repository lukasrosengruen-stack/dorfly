'use client'

import { useState } from 'react'
import { Post, PostChannel, Profile, UserRole } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Loader2, Pin, SlidersHorizontal, Check, Calendar, ImagePlus, Pencil, Trash2, User, LayoutDashboard } from 'lucide-react'
import { clsx } from 'clsx'
import { formatDistanceToNow, format } from 'date-fns'
import { de } from 'date-fns/locale'
import Link from 'next/link'
import { Umfrage } from '@/types/umfrage'
import UmfrageCard from '@/components/umfrage/UmfrageCard'

const TAGS = ['nachricht', 'veranstaltung', 'bekanntmachung'] as const
type PostTag = typeof TAGS[number]

const TAG_META: Record<PostTag, { label: string; color: string }> = {
  nachricht:       { label: 'Nachricht',               color: 'bg-primary-100 text-primary-700' },
  veranstaltung:   { label: 'Veranstaltung',           color: 'bg-purple-100 text-purple-700' },
  bekanntmachung:  { label: 'Bekanntmachung',          color: 'bg-amber-100 text-amber-700' },
}

const CHANNEL_LABELS: Record<PostChannel, string> = {
  gemeinde: 'Gemeinde',
  verein:   'Verein',
  gewerbe:  'Gewerbe',
}

const CHANNEL_COLORS: Record<PostChannel, string> = {
  gemeinde: 'bg-primary-500 text-white',
  verein:   'bg-violet-600 text-white',
  gewerbe:  'bg-orange-500 text-white',
}

const CAN_POST: UserRole[] = ['organisation', 'verein']

function defaultChannel(role?: UserRole): PostChannel {
  if (role === 'verein') return 'verein'
  return 'gemeinde'
}

interface UmfrageMitDaten {
  umfrage: Umfrage
  hatAbgestimmt: boolean
  teilnehmerAnzahl: number
}

interface Props {
  posts: Post[]
  profile: (Profile & { gemeinden?: { name: string } | null }) | null
  alleVereine: string[]
  umfragen: UmfrageMitDaten[]
}

export default function FeedClient({ posts: initialPosts, profile, alleVereine, umfragen: initialUmfragen }: Props) {
  const [posts, setPosts] = useState(initialPosts)
  const [umfragen, setUmfragen] = useState(initialUmfragen)
  const [activeTag, setActiveTag] = useState<PostTag | 'alle'>('alle')
  const [showForm, setShowForm] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [loading, setLoading] = useState(false)
  const [bildFile, setBildFile] = useState<File | null>(null)
  const [bildPreview, setBildPreview] = useState<string | null>(null)
  const [editPost, setEditPost] = useState<Post | null>(null)
  const [eingereicht, setEingereicht] = useState(false)
  const [form, setForm] = useState({
    titel: '',
    inhalt: '',
    tag: 'nachricht' as PostTag,
    channel: defaultChannel(profile?.role),
    veranstaltung_datum: '',
    veranstaltung_uhrzeit: '',
  })

  const gespeicherteEinstellungen = (profile?.feed_einstellungen as { vereine_ausgeblendet?: string[] }) ?? {}
  const [ausgeblendet, setAusgeblendet] = useState<string[]>(
    gespeicherteEinstellungen.vereine_ausgeblendet ?? []
  )

  const supabase = createClient()
  const canPost = profile?.role && CAN_POST.includes(profile.role)
  const isVerwaltung = profile?.role === 'verwaltung' || profile?.role === 'super_admin'

  const filtered = posts.filter(p => {
    if (activeTag !== 'alle' && p.tag !== activeTag) return false
    const vereinName = (p.profiles as { verein_name?: string } | null)?.verein_name
    if (vereinName && ausgeblendet.includes(vereinName)) return false
    return true
  })

  async function saveFilter(neueAusblendungen: string[]) {
    setAusgeblendet(neueAusblendungen)
    await supabase.from('profiles').update({ feed_einstellungen: { vereine_ausgeblendet: neueAusblendungen } }).eq('id', profile?.id ?? '')
  }

  function toggleVerein(name: string) {
    const neu = ausgeblendet.includes(name) ? ausgeblendet.filter(v => v !== name) : [...ausgeblendet, name]
    saveFilter(neu)
  }

  function openEdit(post: Post) {
    const datum = post.veranstaltung_datum ? new Date(post.veranstaltung_datum) : null
    setEditPost(post)
    setForm({
      titel: post.titel, inhalt: post.inhalt,
      tag: (post.tag ?? 'nachricht') as PostTag, channel: post.channel,
      veranstaltung_datum: datum ? datum.toISOString().split('T')[0] : '',
      veranstaltung_uhrzeit: datum ? datum.toTimeString().slice(0, 5) : '',
    })
    setBildPreview(post.bild_url ?? null)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false); setEditPost(null); setBildFile(null); setBildPreview(null)
    setForm({ titel: '', inhalt: '', tag: 'nachricht', channel: defaultChannel(profile?.role), veranstaltung_datum: '', veranstaltung_uhrzeit: '' })
  }

  async function saveEdit() {
    if (!editPost || !form.titel || !form.inhalt) return
    setLoading(true)
    try {
      let bild_url = editPost.bild_url
      if (bildFile) {
        const ext = bildFile.name.split('.').pop()
        const path = `posts/${Date.now()}.${ext}`
        const { error: uploadErr } = await supabase.storage.from('dorfly-media').upload(path, bildFile)
        if (!uploadErr) bild_url = supabase.storage.from('dorfly-media').getPublicUrl(path).data.publicUrl
      } else if (!bildPreview) { bild_url = null }

      const { data, error } = await supabase.from('posts')
        .update({
          titel: form.titel, inhalt: form.inhalt, tag: form.tag, bild_url,
          veranstaltung_datum: form.tag === 'veranstaltung' && form.veranstaltung_datum
            ? new Date(`${form.veranstaltung_datum}T${form.veranstaltung_uhrzeit || '00:00'}`).toISOString() : null,
        })
        .eq('id', editPost.id).select('*, profiles(display_name, avatar_url, role, verein_name)').single()

      if (error) throw error
      setPosts(prev => prev.map(p => p.id === editPost.id ? data as Post : p))
      closeForm()
    } catch { alert('Fehler beim Speichern') }
    finally { setLoading(false) }
  }

  async function deletePost(post: Post) {
    if (!confirm(`"${post.titel}" wirklich löschen?`)) return
    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    if (!error) setPosts(prev => prev.filter(p => p.id !== post.id))
    else alert('Fehler beim Löschen')
  }

  function handleBild(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBildFile(file)
    setBildPreview(URL.createObjectURL(file))
  }

  async function submitPost() {
    if (!form.titel || !form.inhalt || !profile?.gemeinde_id) return
    setLoading(true)
    try {
      let bild_url: string | null = null
      if (bildFile) {
        const ext = bildFile.name.split('.').pop()
        const path = `posts/${Date.now()}.${ext}`
        const { error: uploadErr } = await supabase.storage.from('dorfly-media').upload(path, bildFile)
        if (!uploadErr) bild_url = supabase.storage.from('dorfly-media').getPublicUrl(path).data.publicUrl
      }

      const isVerein = profile.role === 'verein'
      const { error } = await supabase.from('posts')
        .insert({
          gemeinde_id: profile.gemeinde_id!, author_id: profile.id,
          channel: form.channel, titel: form.titel, inhalt: form.inhalt, tag: form.tag,
          status: isVerein ? 'pending' : 'published',
          veranstaltung_datum: form.tag === 'veranstaltung' && form.veranstaltung_datum
            ? new Date(`${form.veranstaltung_datum}T${form.veranstaltung_uhrzeit || '00:00'}`).toISOString() : null,
          bild_url,
        })

      if (error) throw error
      closeForm()
      if (isVerein) setEingereicht(true)
    } catch { alert('Fehler beim Speichern') }
    finally { setLoading(false) }
  }

  return (
    <div>
      {/* Header */}
      <div className="bg-primary-500 px-4 pt-10 pb-0 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-primary-200 text-[10px] font-bold tracking-[0.2em] uppercase">
              {profile?.gemeinden?.name ?? 'Gemeinde Ehningen'}
            </p>
            <h1 className="text-white font-black text-xl tracking-wide uppercase leading-none">Neuigkeiten</h1>
          </div>
          <div className="flex items-center gap-2">
            {isVerwaltung && (
              <Link href="/dashboard" className="flex items-center gap-1 bg-white/20 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg">
                <LayoutDashboard className="w-3.5 h-3.5" />
                Dashboard
              </Link>
            )}
            {alleVereine.length > 0 && (
              <button onClick={() => setShowFilter(true)} className="relative p-2 rounded-xl bg-white/20 text-white">
                <SlidersHorizontal className="w-4 h-4" />
                {ausgeblendet.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
                    {ausgeblendet.length}
                  </span>
                )}
              </button>
            )}
            <Link href="/profil" className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </Link>
          </div>
        </div>

        {/* Tag-Filter */}
        <div className="flex gap-1.5 overflow-x-auto pb-3 scrollbar-none">
          {(['alle', ...TAGS] as const).map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={clsx(
                'shrink-0 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-colors',
                activeTag === tag
                  ? 'bg-white text-primary-500'
                  : 'bg-white/20 text-white/80'
              )}
            >
              {tag === 'alle' ? 'Alle' : TAG_META[tag].label}
            </button>
          ))}
        </div>
      </div>

      {/* Eingereicht-Banner */}
      {eingereicht && (
        <div className="mx-4 mt-4 bg-primary-50 border border-primary-200 rounded-2xl p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-primary-700 font-medium">Dein Beitrag wurde eingereicht und wird geprüft.</p>
          <button onClick={() => setEingereicht(false)} className="text-primary-400 hover:text-primary-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* FAB */}
      {canPost && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="fixed bottom-24 right-4 bg-primary-500 text-white w-14 h-14 rounded-full shadow-xl flex items-center justify-center hover:bg-primary-600 transition-colors z-20 border-2 border-white"
        >
          <Plus className="w-7 h-7" />
        </button>
      )}

      {/* Beitrag erstellen/bearbeiten Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-end sm:items-center justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-4 border-b sticky top-0 bg-white z-10">
              <h2 className="font-black text-gray-900 uppercase tracking-wide">
                {editPost ? 'Beitrag bearbeiten' : 'Neuer Beitrag'}
              </h2>
              <button onClick={closeForm} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Kategorie</p>
                <div className="flex gap-2 flex-wrap">
                  {TAGS.map(tag => (
                    <button
                      key={tag}
                      onClick={() => setForm(f => ({ ...f, tag }))}
                      className={clsx(
                        'px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors uppercase',
                        form.tag === tag ? 'border-primary-500 bg-primary-50 text-primary-600' : 'border-gray-200 text-gray-500'
                      )}
                    >
                      {TAG_META[tag].label}
                    </button>
                  ))}
                </div>
              </div>

              <input
                type="text"
                placeholder="Titel"
                value={form.titel}
                onChange={e => setForm(f => ({ ...f, titel: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 font-bold"
              />
              <textarea
                placeholder="Was möchtest du mitteilen?"
                value={form.inhalt}
                onChange={e => setForm(f => ({ ...f, inhalt: e.target.value }))}
                rows={4}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
              />

              <input type="file" accept="image/*" id="bild-input" className="hidden" onChange={handleBild} />
              <button
                type="button"
                onClick={() => document.getElementById('bild-input')?.click()}
                className={clsx(
                  'w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-bold transition-colors uppercase tracking-wide',
                  bildFile ? 'border-primary-500 text-primary-600 bg-primary-50' : 'border-gray-300 text-gray-500 hover:border-primary-400'
                )}
              >
                <ImagePlus className="w-4 h-4" />
                {bildFile ? bildFile.name : 'Bild hinzufügen'}
              </button>
              {bildPreview && (
                <div className="relative">
                  <img src={bildPreview} alt="Vorschau" className="w-full h-40 object-cover rounded-xl" />
                  <button type="button" onClick={() => { setBildFile(null); setBildPreview(null) }}
                    className="absolute top-2 right-2 bg-black/60 rounded-full p-1">
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              )}

              {form.tag === 'veranstaltung' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block font-bold uppercase">Datum</label>
                    <input type="date" value={form.veranstaltung_datum}
                      onChange={e => setForm(f => ({ ...f, veranstaltung_datum: e.target.value }))}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block font-bold uppercase">Uhrzeit</label>
                    <input type="time" value={form.veranstaltung_uhrzeit}
                      onChange={e => setForm(f => ({ ...f, veranstaltung_uhrzeit: e.target.value }))}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                </div>
              )}

              <button
                onClick={editPost ? saveEdit : submitPost}
                disabled={loading || !form.titel || !form.inhalt}
                className="w-full bg-primary-500 text-white font-black py-3.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-wide text-sm"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {editPost ? 'Änderungen speichern' : profile?.role === 'verein' ? 'Zur Prüfung einreichen' : 'Veröffentlichen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vereins-Filter Modal */}
      {showFilter && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-end sm:items-center justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-4 border-b sticky top-0 bg-white">
              <h2 className="font-black text-gray-900 uppercase tracking-wide">Feed anpassen</h2>
              <button onClick={() => setShowFilter(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-2">
              {alleVereine.map(verein => {
                const aktiv = !ausgeblendet.includes(verein)
                return (
                  <button key={verein} onClick={() => toggleVerein(verein)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:border-primary-300 transition-colors">
                    <span className="font-bold text-gray-900 text-sm">{verein}</span>
                    <span className={clsx('w-6 h-6 rounded-full flex items-center justify-center', aktiv ? 'bg-primary-500' : 'bg-gray-200')}>
                      {aktiv && <Check className="w-3.5 h-3.5 text-white" />}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Feed */}
      <div className="p-4 space-y-4 pt-4">
        {/* Umfragen oben */}
        {umfragen.map(({ umfrage, hatAbgestimmt, teilnehmerAnzahl }) => (
          <UmfrageCard
            key={umfrage.id}
            umfrage={umfrage}
            hatAbgestimmt={hatAbgestimmt}
            teilnehmerAnzahl={teilnehmerAnzahl}
            profile={profile}
            onDelete={id => setUmfragen(prev => prev.filter(u => u.umfrage.id !== id))}
            onUpdate={updated => setUmfragen(prev => prev.map(u => u.umfrage.id === updated.id ? { ...u, umfrage: updated } : u))}
          />
        ))}

        {filtered.length === 0 && umfragen.length === 0 && (
          <div className="text-center text-gray-400 py-16">
            <p className="font-bold text-base uppercase tracking-wide">Keine Beiträge</p>
            {canPost && <p className="text-sm mt-1">Erstelle den ersten Beitrag!</p>}
          </div>
        )}

        {filtered.map(post => {
          const tag = (post.tag ?? 'nachricht') as PostTag
          const tagMeta = TAG_META[tag] ?? TAG_META.nachricht
          const autor = (post.profiles as { display_name?: string; verein_name?: string } | null)
          const autorName = autor?.verein_name ?? autor?.display_name ?? 'Gemeinde Ehningen'
          const isOwner = post.author_id === profile?.id

          return (
            <article key={post.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {/* Kanal-Streifen oben */}
              <div className={clsx('px-4 py-2 flex items-center justify-between', CHANNEL_COLORS[post.channel])}>
                <span className="text-xs font-black uppercase tracking-widest">
                  {CHANNEL_LABELS[post.channel]}
                </span>
                <div className="flex items-center gap-2">
                  {post.pinned && (
                    <span className="flex items-center gap-1 text-xs font-bold opacity-90">
                      <Pin className="w-3 h-3" /> Angepinnt
                    </span>
                  )}
                  {isOwner && (
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(post)} className="p-1 rounded-md bg-white/20 hover:bg-white/30">
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button onClick={() => deletePost(post)} className="p-1 rounded-md bg-white/20 hover:bg-white/30">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Bild */}
              {post.bild_url && (
                <img src={post.bild_url} alt={post.titel} className="w-full h-48 object-cover" />
              )}

              <div className="p-4">
                {/* Tag + Datum */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wide', tagMeta.color)}>
                    {tagMeta.label}
                  </span>
                  <span className="text-xs text-gray-400 ml-auto">
                    {formatDistanceToNow(new Date(post.published_at), { addSuffix: true, locale: de })}
                  </span>
                </div>

                {/* Titel */}
                <h2 className="font-black text-gray-900 text-base leading-snug uppercase tracking-wide">
                  {post.titel}
                </h2>

                {/* Veranstaltungsdatum */}
                {post.veranstaltung_datum && (
                  <div className="flex items-center gap-1.5 mt-2 px-3 py-2 bg-purple-50 rounded-xl">
                    <Calendar className="w-4 h-4 text-purple-600 shrink-0" />
                    <span className="text-sm text-purple-700 font-bold">
                      {format(new Date(post.veranstaltung_datum), 'EEEE, d. MMMM yyyy · HH:mm', { locale: de })} Uhr
                    </span>
                  </div>
                )}

                {/* Inhalt */}
                <p className="text-gray-600 text-sm mt-2 leading-relaxed line-clamp-3">{post.inhalt}</p>

                {/* Autor */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                  <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-black text-primary-700 shrink-0">
                    {autorName[0]?.toUpperCase()}
                  </div>
                  <span className="text-xs text-gray-500 font-medium flex-1 truncate">{autorName}</span>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
