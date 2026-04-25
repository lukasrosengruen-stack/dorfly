'use client'

import { useState } from 'react'
import { Post, PostChannel, Profile } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
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
  gemeinde: 'Gemeinde',
  verein:   'Verein',
  gewerbe:  'Gewerbe',
}

const CHANNEL_COLORS: Record<PostChannel, string> = {
  gemeinde: 'bg-primary-500 text-white',
  verein:   'bg-violet-600 text-white',
  gewerbe:  'bg-orange-500 text-white',
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
  const [umfragen, setUmfragen] = useState(initialUmfragen)
  const [activeTag, setActiveTag] = useState<PostTag | 'alle'>('alle')
  const [showFilter, setShowFilter] = useState(false)
  const [gallery, setGallery] = useState<{ bilder: string[]; index: number } | null>(null)

  const gespeicherteEinstellungen = (profile?.feed_einstellungen as { vereine_ausgeblendet?: string[] }) ?? {}
  const [ausgeblendet, setAusgeblendet] = useState<string[]>(
    gespeicherteEinstellungen.vereine_ausgeblendet ?? []
  )

  const supabase = createClient()
  const isVerwaltung = profile?.role === 'verwaltung' || profile?.role === 'super_admin'
  const hasDashboard = isVerwaltung || profile?.role === 'verein'

  const filtered = initialPosts.filter(p => {
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

  return (
    <div>
      {/* Header */}
      <div className="bg-primary-500 px-4 pt-10 pb-0 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
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
                'shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors',
                activeTag === tag ? 'bg-gold-500 text-white' : 'bg-white/15 text-white/75'
              )}
            >
              {tag === 'alle' ? 'Alle' : TAG_META[tag].label}
            </button>
          ))}
        </div>
      </div>

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
          </div>
        )}

        {filtered.map(post => {
          const tag = (post.tag ?? 'nachricht') as PostTag
          const tagMeta = TAG_META[tag] ?? TAG_META.nachricht
          const autor = (post.profiles as { display_name?: string; verein_name?: string } | null)
          const autorName = autor?.verein_name ?? autor?.display_name ?? 'Gemeinde Ehningen'

          const bilder = (post.bilder_urls && (post.bilder_urls as string[]).length > 0)
            ? post.bilder_urls as string[]
            : post.bild_url ? [post.bild_url] : []

          return (
            <article key={post.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className={clsx('px-4 py-2 flex items-center justify-between', CHANNEL_COLORS[post.channel])}>
                <span className="text-xs font-black uppercase tracking-widest">
                  {CHANNEL_LABELS[post.channel]}
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

                <p className="text-gray-600 text-sm mt-2 leading-relaxed line-clamp-3">{post.inhalt}</p>

                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                  <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-black text-primary-700 shrink-0">
                    {autorName[0]?.toUpperCase()}
                  </div>
                  <span className="text-xs text-gray-500 font-medium flex-1 truncate">{autorName}</span>
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
