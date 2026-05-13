'use client'

import { useState } from 'react'
import { Building2, Users, PenLine, ChevronDown, ChevronUp, Pencil, Trash2, Loader2, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'
import { toast } from 'sonner'
import { PageHeader, Card, Button } from '@/components/ui'
import { GewerbeProfilForm, GewerbePostForm, AbonnentenStats } from '@/features/gewerbe'
import { RichTextEditor, renderRichText } from '@/lib/richText'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/compressImage'
import type { Organisation, Post, Profile, Gewerbebranche } from '@/types/database'

interface Props {
  profile: Profile & { gemeinden?: { name: string } | null }
  betrieb: Organisation | null
  branchen: Gewerbebranche[]
  abonnentenStats: { gesamt: number; letzter7Tage: number; letzter30Tage: number } | null
  posts: Post[]
  naechsterMontag: string | null
}

export default function GewerbeDashboardClient({ profile, betrieb: initialBetrieb, branchen, abonnentenStats, posts: initialPosts, naechsterMontag: initialNaechsterMontag }: Props) {
  const [betrieb, setBetrieb] = useState(initialBetrieb)
  const [posts, setPosts] = useState(initialPosts)
  const [naechsterMontag, setNaechsterMontag] = useState(initialNaechsterMontag)
  const [tab, setTab] = useState<'posts' | 'profil'>('posts')
  const [profilOpen, setProfilOpen] = useState(!initialBetrieb)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ titel: string; text: string; bildUrl: string | null; ablaufdatum: string; neuesBild: boolean }>({ titel: '', text: '', bildUrl: null, ablaufdatum: '', neuesBild: false })
  const [editBildrechte, setEditBildrechte] = useState(false)
  const [editUploading, setEditUploading] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const gemeindeName = (profile as { gemeinden?: { name: string } | null }).gemeinden?.name ?? ''

  function handlePostCreated(post: Post) {
    setPosts(prev => [post, ...prev])
    if (betrieb?.plan === 'standard') {
      const nextMonday = new Date()
      const day = nextMonday.getDay()
      const diffToMonday = day === 0 ? -6 : 1 - day
      nextMonday.setDate(nextMonday.getDate() + diffToMonday + 7)
      nextMonday.setHours(0, 0, 0, 0)
      setNaechsterMontag(nextMonday.toISOString())
    }
  }

  function openEdit(post: Post) {
    setEditingId(post.id)
    setEditBildrechte(false)
    setEditForm({
      titel: post.titel ?? '',
      text: post.inhalt,
      bildUrl: post.bild_url ?? null,
      ablaufdatum: post.publish_at ? post.publish_at.split('T')[0] : '',
      neuesBild: false,
    })
  }

  function closeEdit() {
    setEditingId(null)
    setEditBildrechte(false)
    setEditForm({ titel: '', text: '', bildUrl: null, ablaufdatum: '', neuesBild: false })
  }

  async function handleEditBildChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setEditUploading(true)
    try {
      const compressed = await compressImage(file)
      const supabase = createClient()
      const path = `gewerbe/${betrieb!.id}/post_${Date.now()}.jpg`
      const { error } = await supabase.storage.from('dorfly-media').upload(path, compressed)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('dorfly-media').getPublicUrl(path)
      setEditForm(f => ({ ...f, bildUrl: publicUrl, neuesBild: true }))
      setEditBildrechte(false)
    } catch {
      toast.error('Bild-Upload fehlgeschlagen')
    } finally {
      setEditUploading(false)
    }
  }

  async function submitEdit() {
    if (!editingId || !editForm.text.trim()) return
    setEditSaving(true)
    try {
      const res = await fetch('/api/gewerbe/post', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: editingId,
          titel: editForm.titel.trim() || undefined,
          text: editForm.text.trim(),
          bildUrl: editForm.bildUrl ?? null,
          ablaufdatum: editForm.ablaufdatum || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Fehler beim Speichern'); return }
      setPosts(prev => prev.map(p => p.id === editingId ? { ...p, inhalt: editForm.text.trim(), bild_url: editForm.bildUrl, publish_at: editForm.ablaufdatum || null } : p))
      closeEdit()
      toast.success('Beitrag aktualisiert')
    } catch {
      toast.error('Fehler beim Speichern')
    } finally {
      setEditSaving(false)
    }
  }

  async function deletePost(id: string) {
    if (!confirm('Beitrag wirklich löschen?')) return
    setDeleting(id)
    try {
      const res = await fetch('/api/gewerbe/post', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: id }),
      })
      if (!res.ok) throw new Error()
      setPosts(prev => prev.filter(p => p.id !== id))
      setNaechsterMontag(null)
      if (editingId === id) closeEdit()
      toast.success('Beitrag gelöscht')
    } catch {
      toast.error('Fehler beim Löschen')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div>
      <PageHeader gemeindeName={gemeindeName} title="Mein Gewerbe" />

      <div className="p-4 space-y-4 pt-4">
        {/* Kein Betrieb angelegt */}
        {!betrieb && (
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="font-black text-gray-900 text-sm uppercase tracking-wide">Profil anlegen</p>
                <p className="text-xs text-gray-500">Ihr Betrieb ist noch nicht eingerichtet</p>
              </div>
            </div>
            <GewerbeProfilForm
              betrieb={{
                id: '', gemeinde_id: profile.gemeinde_id ?? '', profile_id: profile.id,
                name: '', typ: 'gewerbe', beschreibung: null, logo_url: null, website: null,
                verified: false, branche_id: null, adresse: null, oeffnungszeiten: null, plan: 'standard',
                created_at: new Date().toISOString(),
              }}
              branchen={branchen}
              onUpdated={updated => setBetrieb(updated)}
            />
          </Card>
        )}

        {betrieb && (
          <>
            {/* Abonnenten */}
            {abonnentenStats && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-gray-400" />
                  <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Abonnenten</p>
                </div>
                <AbonnentenStats {...abonnentenStats} />
              </div>
            )}

            {/* Tab-Navigation */}
            <div className="flex gap-2">
              <TabButton active={tab === 'posts'} icon={<PenLine className="w-3.5 h-3.5" />} onClick={() => setTab('posts')}>
                Beiträge
              </TabButton>
              <TabButton active={tab === 'profil'} icon={<Building2 className="w-3.5 h-3.5" />} onClick={() => setTab('profil')}>
                Profil
              </TabButton>
            </div>

            {/* Posts Tab */}
            {tab === 'posts' && (
              <div className="space-y-4">
                <Card>
                  <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">
                    Neuer Beitrag
                  </p>
                  <GewerbePostForm
                    gewerbeId={betrieb.id}
                    naechsterMontag={naechsterMontag}
                    onCreated={handlePostCreated}
                  />
                </Card>

                {/* Bearbeitungsformular */}
                {editingId && (
                  <Card>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Beitrag bearbeiten</p>
                      <button type="button" onClick={closeEdit}>
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="Überschrift"
                        value={editForm.titel}
                        onChange={e => setEditForm(f => ({ ...f, titel: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <RichTextEditor
                        value={editForm.text}
                        onChange={v => setEditForm(f => ({ ...f, text: v }))}
                        placeholder="Text bearbeiten…"
                        rows={4}
                        compact
                      />

                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">Bild (optional)</label>
                          {editForm.bildUrl ? (
                            <div className="relative">
                              <img src={editForm.bildUrl} alt="Vorschau" className="w-full h-32 object-cover rounded-xl" />
                              <button type="button" onClick={() => setEditForm(f => ({ ...f, bildUrl: null }))}
                                className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                                Entfernen
                              </button>
                            </div>
                          ) : (
                            <label className="cursor-pointer block">
                              <span className="block text-xs font-bold text-primary-500 bg-primary-50 px-3 py-2 rounded-xl text-center">
                                {editUploading ? 'Lädt…' : 'Bild auswählen'}
                              </span>
                              <input type="file" accept="image/*" className="hidden" onChange={handleEditBildChange} disabled={editUploading} />
                            </label>
                          )}
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">Ablaufdatum (optional)</label>
                          <input type="date" value={editForm.ablaufdatum}
                            onChange={e => setEditForm(f => ({ ...f, ablaufdatum: e.target.value }))}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                        </div>
                      </div>

                      {editForm.neuesBild && (
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editBildrechte}
                            onChange={e => setEditBildrechte(e.target.checked)}
                            className="mt-0.5 rounded shrink-0"
                          />
                          <span className="text-xs text-gray-600 leading-relaxed">
                            Ich bestätige, dass ich die erforderlichen Nutzungsrechte an diesem Bild besitze und es für die Veröffentlichung durch die Kommune freigebe.
                          </span>
                        </label>
                      )}
                      <Button onClick={submitEdit} fullWidth loading={editSaving || editUploading} disabled={editSaving || editUploading || (editForm.neuesBild && !editBildrechte)}>
                        Änderungen speichern
                      </Button>
                    </div>
                  </Card>
                )}

                {posts.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Ihre Beiträge</p>
                    {posts.map(post => (
                      <Card key={post.id} padding="none">
                        {post.bild_url && (
                          <img src={post.bild_url} alt={post.titel} className="w-full h-36 object-cover" />
                        )}
                        <div className="p-4">
                          <div className="flex items-start gap-2">
                            <p className="text-sm text-gray-700 leading-relaxed flex-1 whitespace-pre-wrap">
                              {renderRichText(post.inhalt)}
                            </p>
                            <div className="flex gap-1 shrink-0">
                              <button onClick={() => openEdit(post)}
                                className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">
                                <Pencil className="w-3.5 h-3.5 text-gray-500" />
                              </button>
                              <button onClick={() => deletePost(post.id)} disabled={deleting === post.id}
                                className="p-1.5 rounded-lg bg-gray-100 hover:bg-red-100 transition-colors disabled:opacity-50">
                                {deleting === post.id
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                                  : <Trash2 className="w-3.5 h-3.5 text-gray-500" />}
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-gray-400 mt-2">
                            {formatDistanceToNow(new Date(post.published_at), { addSuffix: true, locale: de })}
                          </p>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Profil Tab */}
            {tab === 'profil' && (
              <Card>
                <button
                  onClick={() => setProfilOpen(o => !o)}
                  className="w-full flex items-center justify-between mb-4"
                >
                  <p className="text-xs font-black text-gray-500 uppercase tracking-widest">
                    Profil bearbeiten
                  </p>
                  {profilOpen
                    ? <ChevronUp className="w-4 h-4 text-gray-400" />
                    : <ChevronDown className="w-4 h-4 text-gray-400" />
                  }
                </button>
                {profilOpen && (
                  <GewerbeProfilForm betrieb={betrieb} branchen={branchen} onUpdated={setBetrieb} />
                )}
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function TabButton({ active, icon, onClick, children }: {
  active: boolean
  icon: React.ReactNode
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition-colors ${
        active ? 'bg-orange-500 text-white' : 'bg-white text-gray-500 shadow-[0_2px_8px_rgba(15,45,107,0.08)]'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}
