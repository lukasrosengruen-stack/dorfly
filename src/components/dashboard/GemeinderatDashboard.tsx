'use client'


import { toast } from 'sonner'
import { useState } from 'react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { Scale, MessageCircle, CheckCircle2, Clock, Send, Loader2, Pencil, Trash2, X } from 'lucide-react'
import { clsx } from 'clsx'
import PostErstellenButton from './PostErstellenButton'

interface Post {
  id: string
  titel: string
  inhalt: string
  tag: string | null
  status: string
  published_at: string
  rejection_reason?: string | null
}

interface Frage {
  id: string
  frage: string
  antwort: string | null
  status: string
  created_at: string
  fragesteller?: { display_name: string | null } | null
}

interface Props {
  posts: Post[]
  fragen: Frage[]
  gemeindeId: string
  profileId: string
  fraktion: string | null
  ueber_mich: string | null
  kontakt_email: string | null
  social_x: string | null
  social_facebook: string | null
  social_instagram: string | null
  social_tiktok: string | null
}

export default function GemeinderatDashboard({ posts, fragen, gemeindeId, profileId, fraktion: initialFraktion, ueber_mich: initialUeberMich, kontakt_email: initialKontaktEmail, social_x: initialSocialX, social_facebook: initialSocialFacebook, social_instagram: initialSocialInstagram, social_tiktok: initialSocialTiktok }: Props) {
  const [activeTab, setActiveTab] = useState<'beitraege' | 'fragen' | 'profil'>('fragen')
  const [fraktion, setFraktion] = useState(initialFraktion ?? '')
  const [ueber_mich, setUeberMich] = useState(initialUeberMich ?? '')
  const [kontakt_email, setKontaktEmail] = useState(initialKontaktEmail ?? '')
  const [social_x, setSocialX] = useState(initialSocialX ?? '')
  const [social_facebook, setSocialFacebook] = useState(initialSocialFacebook ?? '')
  const [social_instagram, setSocialInstagram] = useState(initialSocialInstagram ?? '')
  const [social_tiktok, setSocialTiktok] = useState(initialSocialTiktok ?? '')
  const [profilSaving, setProfilSaving] = useState(false)
  const [antworten, setAntworten] = useState<Record<string, string>>({})
  const [sending, setSending] = useState<string | null>(null)
  const [beantwortet, setBeantwortet] = useState<Set<string>>(new Set())
  const [editPost, setEditPost] = useState<Post | null>(null)
  const [editForm, setEditForm] = useState({ titel: '', inhalt: '', tag: '' })
  const [editLoading, setEditLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [localPosts, setLocalPosts] = useState(posts)

  async function saveProfil() {
    setProfilSaving(true)
    const res = await fetch('/api/profil/gemeinderat', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fraktion:         fraktion || null,
        ueber_mich:       ueber_mich || null,
        kontakt_email:    kontakt_email || null,
        social_x:         social_x || null,
        social_facebook:  social_facebook || null,
        social_instagram: social_instagram || null,
        social_tiktok:    social_tiktok || null,
      }),
    })
    setProfilSaving(false)
    if (res.ok) toast.success('Profil gespeichert')
    else toast.error('Fehler beim Speichern')
  }

  function openEdit(post: Post) {
    setEditPost(post)
    setEditForm({ titel: post.titel, inhalt: post.inhalt, tag: post.tag ?? 'nachricht' })
  }

  async function saveEdit() {
    if (!editPost || !editForm.titel || !editForm.inhalt) return
    setEditLoading(true)
    const res = await fetch('/api/posts/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editPost.id, titel: editForm.titel, inhalt: editForm.inhalt, tag: editForm.tag }),
    })
    setEditLoading(false)
    if (res.ok) {
      setLocalPosts(prev => prev.map(p => p.id === editPost.id
        ? { ...p, titel: editForm.titel, inhalt: editForm.inhalt, tag: editForm.tag, status: 'pending' }
        : p))
      setEditPost(null)
      toast.success('Beitrag zur Freigabe eingereicht')
    } else {
      toast.error('Fehler beim Speichern')
    }
  }

  async function deletePost(postId: string) {
    setDeletingId(postId)
    const res = await fetch('/api/posts/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: postId }),
    })
    setDeletingId(null)
    if (res.ok) {
      setLocalPosts(prev => prev.filter(p => p.id !== postId))
      toast.success('Beitrag gelöscht')
    } else {
      toast.error('Fehler beim Löschen')
    }
  }

  async function sendAntwort(frageId: string) {
    const antwort = antworten[frageId]
    if (!antwort?.trim()) return
    setSending(frageId)
    const res = await fetch('/api/gemeinderat/antwort', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frageId, antwort }),
    })
    setSending(null)
    if (res.ok) {
      setBeantwortet(prev => new Set([...prev, frageId]))
      setAntworten(prev => ({ ...prev, [frageId]: '' }))
    } else {
      toast.error('Fehler beim Senden der Antwort')
    }
  }

  const offeneFragen = fragen.filter(f => f.status === 'offen' && !beantwortet.has(f.id))
  const beantworteteFragen = fragen.filter(f => f.status === 'beantwortet' || beantwortet.has(f.id))

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 pt-8 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-0.5">Gemeinderat</p>
            <h1 className="text-2xl font-bold text-gray-900">Mein Dashboard</h1>
          </div>
          <PostErstellenButton gemeindeId={gemeindeId} profileId={profileId} defaultChannel="gemeinderat" />
        </div>
      </div>

      <div className="px-8 py-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-primary-50 rounded-2xl p-4">
            <Scale className="w-5 h-5 text-primary-500 mb-2" />
            <p className="text-2xl font-bold text-gray-900">{localPosts.length}</p>
            <p className="text-xs text-gray-500 font-medium mt-0.5">Beiträge</p>
          </div>
          <div className="bg-amber-50 rounded-2xl p-4">
            <Clock className="w-5 h-5 text-amber-500 mb-2" />
            <p className="text-2xl font-bold text-gray-900">{offeneFragen.length}</p>
            <p className="text-xs text-gray-500 font-medium mt-0.5">Offene Fragen</p>
          </div>
          <div className="bg-green-50 rounded-2xl p-4">
            <CheckCircle2 className="w-5 h-5 text-green-500 mb-2" />
            <p className="text-2xl font-bold text-gray-900">{beantworteteFragen.length}</p>
            <p className="text-xs text-gray-500 font-medium mt-0.5">Beantwortet</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {[
            { id: 'fragen', label: `Fragen (${offeneFragen.length} offen)` },
            { id: 'beitraege', label: 'Meine Beiträge' },
            { id: 'profil', label: 'Mein Profil' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'beitraege' | 'fragen' | 'profil')}
              className={clsx(
                'px-4 py-2 rounded-xl text-sm font-semibold transition-colors',
                activeTab === tab.id ? 'bg-primary-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* FRAGEN TAB */}
        {activeTab === 'fragen' && (
          <div className="space-y-4">
            {fragen.length === 0 && (
              <div className="bg-white rounded-2xl shadow-sm px-5 py-10 text-center text-gray-400">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="font-medium">Noch keine Fragen eingegangen</p>
              </div>
            )}

            {offeneFragen.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Offene Fragen</h3>
                {offeneFragen.map(frage => (
                  <div key={frage.id} className="bg-white rounded-2xl shadow-sm p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="font-medium text-gray-900 text-sm leading-relaxed">{frage.frage}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {frage.fragesteller?.display_name ?? 'Bürger'} ·{' '}
                          {format(new Date(frage.created_at), 'dd. MMM yyyy', { locale: de })}
                        </p>
                      </div>
                      <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-medium shrink-0">Offen</span>
                    </div>
                    <textarea
                      value={antworten[frage.id] ?? ''}
                      onChange={e => setAntworten(prev => ({ ...prev, [frage.id]: e.target.value }))}
                      placeholder="Deine Antwort…"
                      rows={3}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 mb-2"
                    />
                    <button
                      onClick={() => sendAntwort(frage.id)}
                      disabled={sending === frage.id || !antworten[frage.id]?.trim()}
                      className="flex items-center gap-2 bg-primary-500 text-white text-sm font-bold px-4 py-2 rounded-xl disabled:opacity-50"
                    >
                      {sending === frage.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Antworten
                    </button>
                  </div>
                ))}
              </div>
            )}

            {beantworteteFragen.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Beantwortet</h3>
                {beantworteteFragen.map(frage => (
                  <div key={frage.id} className="bg-white rounded-2xl shadow-sm p-5 opacity-75">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="font-medium text-gray-900 text-sm">{frage.frage}</p>
                      <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium shrink-0">Beantwortet</span>
                    </div>
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2 mt-2">{frage.antwort}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PROFIL TAB */}
        {activeTab === 'profil' && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5 max-w-lg">
            <div>
              <label htmlFor="profil-fraktion" className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Fraktion</label>
              <input
                id="profil-fraktion"
                type="text"
                value={fraktion}
                onChange={e => setFraktion(e.target.value)}
                placeholder="z.B. SPD, CDU, Grüne, FW …"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label htmlFor="profil-kontakt-email" className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Kontakt-E-Mail (öffentlich)</label>
              <input
                id="profil-kontakt-email"
                type="email"
                value={kontakt_email}
                onChange={e => setKontaktEmail(e.target.value)}
                placeholder="deine@email.de"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <p className="text-xs text-gray-400 mt-1">Wird Bürgern angezeigt, damit sie dich direkt per E-Mail kontaktieren können.</p>
            </div>
            <div>
              <label htmlFor="profil-ueber-mich" className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Über mich</label>
              <textarea
                id="profil-ueber-mich"
                value={ueber_mich}
                onChange={e => setUeberMich(e.target.value)}
                placeholder="Stell dich den Bürgerinnen und Bürgern vor …"
                rows={5}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{ueber_mich.length} / 1000</p>
            </div>
            <fieldset>
              <legend className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Social Media</legend>
              <div className="space-y-3">
                {[
                  { label: 'X / Twitter', key: 'x', value: social_x, setter: setSocialX,
                    icon: <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
                  { label: 'Facebook', key: 'facebook', value: social_facebook, setter: setSocialFacebook,
                    icon: <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> },
                  { label: 'Instagram', key: 'instagram', value: social_instagram, setter: setSocialInstagram,
                    icon: <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg> },
                  { label: 'TikTok', key: 'tiktok', value: social_tiktok, setter: setSocialTiktok,
                    icon: <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.75a8.27 8.27 0 004.84 1.54V6.83a4.85 4.85 0 01-1.07-.14z"/></svg> },
                ].map(({ label, key, value, setter, icon }) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-gray-400 shrink-0 w-5 flex justify-center">{icon}</span>
                    <label htmlFor={`social-${key}`} className="text-xs text-gray-500 w-24 shrink-0">{label}</label>
                    <input
                      id={`social-${key}`}
                      type="text"
                      value={value}
                      onChange={e => setter(e.target.value)}
                      placeholder="@username"
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                ))}
              </div>
            </fieldset>
            <button
              onClick={saveProfil}
              disabled={profilSaving}
              className="flex items-center gap-2 bg-primary-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm disabled:opacity-50"
            >
              {profilSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Speichern
            </button>
          </div>
        )}

        {/* BEITRÄGE TAB */}
        {activeTab === 'beitraege' && (
          <div className="space-y-3">
            {localPosts.length === 0 && (
              <div className="bg-white rounded-2xl shadow-sm px-5 py-10 text-center text-gray-400">
                <Scale className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="font-medium">Noch keine Beiträge verfasst</p>
              </div>
            )}
            {localPosts.map(post => (
              <div key={post.id} className="bg-white rounded-2xl shadow-sm p-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm truncate">{post.titel}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {format(new Date(post.published_at), 'dd. MMM yyyy', { locale: de })}
                      {post.tag && ` · ${post.tag.charAt(0).toUpperCase() + post.tag.slice(1)}`}
                    </p>
                  </div>
                  <span className={clsx(
                    'text-xs px-2 py-0.5 rounded-full font-medium shrink-0',
                    post.status === 'published' ? 'bg-green-100 text-green-700' :
                    post.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  )}>
                    {post.status === 'published' ? 'Veröffentlicht' :
                     post.status === 'rejected' ? 'Abgelehnt' : 'Ausstehend'}
                  </span>
                  <button onClick={() => openEdit(post)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deletePost(post.id)}
                    disabled={deletingId === post.id}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                  >
                    {deletingId === post.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
                {post.status === 'rejected' && post.rejection_reason && (
                  <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                    <span className="font-bold">Ablehnungsgrund: </span>{post.rejection_reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit-Modal */}
      {editPost && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
              <h2 className="font-bold text-gray-900 text-lg">Beitrag bearbeiten</h2>
              <button onClick={() => setEditPost(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2.5 rounded-xl border border-amber-200">
                ⏳ Nach dem Speichern wird der Beitrag erneut zur Freigabe eingereicht.
              </p>
              <input
                type="text"
                value={editForm.titel}
                onChange={e => setEditForm(f => ({ ...f, titel: e.target.value }))}
                placeholder="Titel"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 font-bold"
              />
              <textarea
                value={editForm.inhalt}
                onChange={e => setEditForm(f => ({ ...f, inhalt: e.target.value }))}
                placeholder="Inhalt"
                rows={6}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                onClick={saveEdit}
                disabled={editLoading || !editForm.titel || !editForm.inhalt}
                className="w-full bg-primary-500 text-white font-bold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {editLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Speichern & zur Freigabe einreichen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
