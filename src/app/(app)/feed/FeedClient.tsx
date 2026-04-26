'use client'

import { useState } from 'react'
import { Post, PostChannel, Profile } from '@/types/database'
import { X, Pin, SlidersHorizontal, Check, Calendar, MapPin, User, LayoutDashboard, Images } from 'lucide-react'
import { clsx } from 'clsx'
import { formatDistanceToNow, format } from 'date-fns'
import { de } from 'date-fns/locale'
import Link from 'next/link'
import GalleryLightbox from '@/components/GalleryLightbox'
import { Umfrage } from '@/types/umfrage'
import UmfrageCard from '@/components/umfrage/UmfrageCard'
import ShareButton from '@/components/ShareButton'

const TAGS = ['nachricht', 'veranstaltung', 'bekanntmachung'] as const
type PostTag = typeof TAGS[number]

const TAG_META: Record<PostTag, { label: string; color: string }> = {
  nachricht:      { label: 'Nachricht',      color: 'bg-primary-100 text-primary-700' },
  veranstaltung:  { label: 'Veranstaltung',  color: 'bg-purple-100 text-purple-700' },
  bekanntmachung: { label: 'Bekanntmachung', color: 'bg-amber-100 text-amber-700' },
}

const CHANNEL_LABELS: Record<PostChannel, string> = {
  gemeinde:    'Gemeinde',
  verein:      'Verein',
  gewerbe:     'Gewerbe',
  gemeinderat: 'Gemeinderat',
}

const CHANNEL_COLORS: Record<PostChannel, string> = {
  gemeinde:    'bg-primary-500 text-white',
  verein:      'bg-violet-600 text-white',
  gewerbe:     'bg-orange-500 text-white',
  gemeinderat: 'bg-primary-700 text-white',
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

export default function FeedClient({ posts: initialPosts, profile, alleVereine: _alleVereine, umfragen: initialUmfragen }: Props) {
  const [umfragen, setUmfragen] = useState(initialUmfragen)
  const [showFilter, setShowFilter] = useState(false)
  const [gallery, setGallery] = useState<{ bilder: string[]; index: number } | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [selectedSenders, setSelectedSenders] = useState<Set<string>>(new Set())

  const isVerwaltung = profile?.role === 'verwaltung' || profile?.role === 'super_admin'
  const hasDashboard = isVerwaltung || profile?.role === 'verein' || profile?.role === 'organisation' || profile?.role === 'gemeinderat'

  // Derive available senders from posts
  const hasVerwaltungPosts = initialPosts.some(p => {
    const r = (p.profiles as { role?: string } | null)?.role
    return r === 'verwaltung' || r === 'super_admin'
  })
  const vereinNames = [...new Set(
    initialPosts
      .map(p => (p.profiles as { verein_name?: string | null } | null)?.verein_name)
      .filter((v): v is string => !!v)
  )]

  const activeFilterCount = selectedTags.size + selectedSenders.size

  function toggleTag(tag: string) {
    setSelectedTags(prev => { const s = new Set(prev); s.has(tag) ? s.delete(tag) : s.add(tag); return s })
  }
  function toggleSender(sender: string) {
    setSelectedSenders(prev => { const s = new Set(prev); s.has(sender) ? s.delete(sender) : s.add(sender); return s })
  }

  const filtered = initialPosts.filter(p => {
    if (selectedTags.size > 0 && p.tag && !selectedTags.has(p.tag)) return false
    if (selectedSenders.size > 0) {
      const autor = (p.profiles as { verein_name?: string | null; role?: string } | null)
      const isVerwaltungPost = autor?.role === 'verwaltung' || autor?.role === 'super_admin'
      const vereinName = autor?.verein_name
      if (isVerwaltungPost && !selectedSenders.has('__verwaltung__')) return false
      if (!isVerwaltungPost && vereinName && !selectedSenders.has(vereinName)) return false
    }
    return true
  })

  return (
    <div>
      {/* Header */}
      <div className="bg-primary-500 px-4 pt-10 pb-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gold-500 text-[10px] font-bold tracking-[3px] uppercase">
              {profile?.gemeinden?.name ?? 'Gemeinde Ehningen'}
            </p>
            <h1 className="text-white font-extrabold text-[22px] leading-tight mt-0.5">Neuigkeiten</h1>
          </div>
          <div className="flex items-center gap-2">
            {hasDashboard && (
              <Link href="/dashboard" className="flex items-center gap-1 bg-white/20 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg">
                <LayoutDashboard className="w-3.5 h-3.5" />
                Dashboard
              </Link>
            )}
            <button onClick={() => setShowFilter(true)} className="relative flex items-center gap-1.5 bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-xl">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filtern
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 bg-gold-500 rounded-full text-white text-[10px] flex items-center justify-center font-black">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <Link href="/profil" className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </Link>
          </div>
        </div>
      </div>

      {/* Filter Bottom Sheet */}
      {showFilter && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-end justify-center" onClick={() => setShowFilter(false)}>
          <div className="bg-white w-full max-w-lg rounded-t-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white">
              <h2 className="font-black text-gray-900 uppercase tracking-wide text-sm">Feed filtern</h2>
              <div className="flex items-center gap-3">
                {activeFilterCount > 0 && (
                  <button onClick={() => { setSelectedTags(new Set()); setSelectedSenders(new Set()) }}
                    className="text-xs text-primary-500 font-bold">
                    Zurücksetzen
                  </button>
                )}
                <button onClick={() => setShowFilter(false)}>
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-6">
              {/* Kategorie */}
              <div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Kategorie</p>
                <div className="space-y-2">
                  {TAGS.map(tag => {
                    const aktiv = selectedTags.has(tag)
                    return (
                      <button key={tag} onClick={() => toggleTag(tag)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-colors"
                        style={{ borderColor: aktiv ? undefined : '#e5e7eb' }}
                        {...(aktiv ? { 'data-active': true } : {})}
                      >
                        <div className="flex items-center gap-3">
                          <span className={clsx('text-xs px-2 py-0.5 rounded-full font-bold uppercase', TAG_META[tag].color)}>
                            {TAG_META[tag].label}
                          </span>
                        </div>
                        <span className={clsx('w-6 h-6 rounded-full flex items-center justify-center shrink-0', aktiv ? 'bg-primary-500' : 'bg-gray-100')}>
                          {aktiv && <Check className="w-3.5 h-3.5 text-white" />}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Absender */}
              {(hasVerwaltungPosts || vereinNames.length > 0) && (
                <div>
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Absender</p>
                  <div className="space-y-2">
                    {hasVerwaltungPosts && (
                      <button onClick={() => toggleSender('__verwaltung__')}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 border-gray-200 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-black text-primary-700">V</div>
                          <span className="font-bold text-gray-900 text-sm">Verwaltung</span>
                        </div>
                        <span className={clsx('w-6 h-6 rounded-full flex items-center justify-center shrink-0', selectedSenders.has('__verwaltung__') ? 'bg-primary-500' : 'bg-gray-100')}>
                          {selectedSenders.has('__verwaltung__') && <Check className="w-3.5 h-3.5 text-white" />}
                        </span>
                      </button>
                    )}
                    {vereinNames.map(name => (
                      <button key={name} onClick={() => toggleSender(name)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 border-gray-200 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-xs font-black text-violet-700">
                            {name[0]?.toUpperCase()}
                          </div>
                          <span className="font-bold text-gray-900 text-sm">{name}</span>
                        </div>
                        <span className={clsx('w-6 h-6 rounded-full flex items-center justify-center shrink-0', selectedSenders.has(name) ? 'bg-primary-500' : 'bg-gray-100')}>
                          {selectedSenders.has(name) && <Check className="w-3.5 h-3.5 text-white" />}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
          </div>
        )}

        {filtered.map(post => {
          const tag = (post.tag ?? 'nachricht') as PostTag
          const tagMeta = TAG_META[tag] ?? TAG_META.nachricht
          const autorRaw = post.profiles
          const autor = (Array.isArray(autorRaw) ? autorRaw[0] : autorRaw) as { display_name?: string | null; verein_name?: string | null; role?: string } | null
          const badgeLabel = autor?.verein_name ?? (autor?.role ? autor.role.charAt(0).toUpperCase() + autor.role.slice(1) : CHANNEL_LABELS[post.channel])
          const personName = autor?.display_name ?? autor?.verein_name ?? 'Gemeinde Ehningen'

          const bilder = (post.bilder_urls && (post.bilder_urls as string[]).length > 0)
            ? post.bilder_urls as string[]
            : post.bild_url ? [post.bild_url] : []

          return (
            <article key={post.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className={clsx('px-4 py-2 flex items-center justify-between', CHANNEL_COLORS[post.channel])}>
                <span className="text-xs font-black uppercase tracking-widest">
                  {badgeLabel}
                </span>
                <div className="flex items-center gap-2">
                  {bilder.length > 1 && (
                    <button onClick={() => setGallery({ bilder, index: 0 })}
                      className="flex items-center gap-1 text-xs font-bold opacity-90 bg-white/20 px-2 py-0.5 rounded-full">
                      <Images className="w-3 h-3" /> {bilder.length} Fotos
                    </button>
                  )}
                  {post.pinned && (
                    <span className="flex items-center gap-1 text-xs font-bold opacity-90">
                      <Pin className="w-3 h-3" /> Angepinnt
                    </span>
                  )}
                </div>
              </div>

              {bilder.length > 0 && (
                <div className="relative cursor-pointer" onClick={() => setGallery({ bilder, index: 0 })}>
                  <img src={bilder[0]} alt={post.titel} className="w-full h-48 object-cover" />
                  {bilder.length > 1 && (
                    <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                      <Images className="w-3 h-3" /> {bilder.length}
                    </div>
                  )}
                </div>
              )}

              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wide', tagMeta.color)}>
                    {tagMeta.label}
                  </span>
                  <span className="text-xs text-gray-400 ml-auto">
                    {formatDistanceToNow(new Date(post.published_at), { addSuffix: true, locale: de })}
                  </span>
                </div>

                <h2 className="font-black text-gray-900 text-base leading-snug uppercase tracking-wide">
                  {post.titel}
                </h2>

                {post.veranstaltung_datum && (
                  <div className="mt-2 px-3 py-2 bg-purple-50 rounded-xl space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-purple-600 shrink-0" />
                      <span className="text-sm text-purple-700 font-bold">
                        {format(new Date(post.veranstaltung_datum), 'EEEE, d. MMMM yyyy · HH:mm', { locale: de })} Uhr
                      </span>
                    </div>
                    {post.veranstaltung_ort && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-purple-600 shrink-0" />
                        <span className="text-sm text-purple-700">{post.veranstaltung_ort}</span>
                      </div>
                    )}
                  </div>
                )}

                <div
                  onClick={() => setExpanded(prev => { const s = new Set(prev); s.has(post.id) ? s.delete(post.id) : s.add(post.id); return s })}
                  className="cursor-pointer"
                >
                  <p className={clsx('text-gray-600 text-sm mt-2 leading-relaxed', !expanded.has(post.id) && 'line-clamp-3')}>{post.inhalt}</p>
                  {!expanded.has(post.id) && (
                    <span className="text-xs text-primary-500 font-semibold mt-1 block">Mehr lesen</span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                  <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-black text-primary-700 shrink-0">
                    {personName[0]?.toUpperCase()}
                  </div>
                  <span className="text-xs text-gray-500 font-medium flex-1 truncate">{personName}</span>
                  <ShareButton
                    postId={post.id}
                    titel={post.titel}
                    inhalt={post.inhalt}
                    gemeindeName={profile?.gemeinden?.name ?? 'Ehningen'}
                  />
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {gallery && (
        <GalleryLightbox
          bilder={gallery.bilder}
          startIndex={gallery.index}
          onClose={() => setGallery(null)}
        />
      )}
    </div>
  )
}
