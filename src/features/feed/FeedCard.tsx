'use client'

/**
 * FeedCard – Einzelner Beitrag im Newsfeed
 *
 * Zustandsfrei: bekommt alles per Props.
 * Expand/Collapse wird durch den Parent (FeedClient) verwaltet.
 */
import { Calendar, MapPin, Images, Pin, Users } from 'lucide-react'
import { clsx } from 'clsx'
import { formatDistanceToNow, format } from 'date-fns'
import { de } from 'date-fns/locale'
import { PostMitProfil, PostChannel } from '@/types/database'
import GalleryLightbox from '@/components/GalleryLightbox'
import ShareButton from '@/components/ShareButton'
import ReportButton from '@/components/ReportButton'
import { renderRichText } from '@/lib/richText'
import { useState } from 'react'

// ── Typen & Konstanten ──────────────────────────────────────────────────────

const TAGS = ['nachricht', 'veranstaltung', 'bekanntmachung', 'sammlung', 'eigene_position', 'fraktionsposition'] as const
type PostTag = typeof TAGS[number]

const TAG_META: Record<PostTag, { label: string; color: string }> = {
  nachricht:         { label: 'Nachricht',         color: 'bg-primary-100 text-primary-700' },
  veranstaltung:     { label: 'Veranstaltung',     color: 'bg-purple-100 text-purple-700' },
  bekanntmachung:    { label: 'Bekanntmachung',    color: 'bg-amber-100 text-amber-700' },
  sammlung:          { label: 'Sammlung',          color: 'bg-emerald-100 text-emerald-700' },
  eigene_position:   { label: 'Eigene Position',   color: 'bg-teal-100 text-teal-700' },
  fraktionsposition: { label: 'Fraktionsposition', color: 'bg-sky-100 text-sky-700' },
}

const CHANNEL_COLORS: Record<PostChannel, string> = {
  gemeinde:    'bg-primary-500 text-white',
  verein:      'bg-violet-600 text-white',
  gewerbe:     'bg-orange-500 text-white',
  gemeinderat: 'bg-primary-700 text-white',
  warnung:     'bg-red-600 text-white',
}

// ── Komponente ──────────────────────────────────────────────────────────────

interface FeedCardProps {
  post: PostMitProfil
  expanded: boolean
  onToggleExpand: () => void
  gemeindeName: string
}

export function FeedCard({ post, expanded, onToggleExpand, gemeindeName }: FeedCardProps) {
  const [gallery, setGallery] = useState<{ bilder: string[]; index: number } | null>(null)

  const tag = (post.tag ?? 'nachricht') as PostTag
  const tagMeta = TAG_META[tag] ?? TAG_META.nachricht

  const autorRaw = post.profiles
  const autor = (Array.isArray(autorRaw) ? autorRaw[0] : autorRaw) as {
    display_name?: string | null
    verein_name?: string | null
    role?: string
  } | null

  const CHANNEL_LABELS: Record<PostChannel, string> = {
    gemeinde:    'Gemeinde',
    verein:      'Verein',
    gewerbe:     'Gewerbe',
    gemeinderat: 'Gemeinderat',
    warnung:     'Warnung',
  }

  const badgeLabel = autor?.verein_name
    ?? (autor?.role ? autor.role.charAt(0).toUpperCase() + autor.role.slice(1) : CHANNEL_LABELS[post.channel])
  const personName = autor?.display_name ?? autor?.verein_name ?? gemeindeName

  // Farbe nach Autor-Rolle, nicht nach Channel (verhindert falsche Gewerbe-Farbe für Organisation)
  const bannerColor =
    autor?.role === 'organisation' ? 'bg-teal-600 text-white' :
    autor?.role === 'verein'       ? 'bg-violet-600 text-white' :
    CHANNEL_COLORS[post.channel]

  const bilder = (post.bilder_urls && (post.bilder_urls as string[]).length > 0)
    ? post.bilder_urls as string[]
    : post.bild_url ? [post.bild_url] : []

  return (
    <>
      <article className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(15,45,107,0.08)] overflow-hidden">
        {/* Kanal-Banner */}
        <div className={clsx('px-4 py-2 flex items-center justify-between', bannerColor)}>
          <span className="text-xs font-black uppercase tracking-widest">{badgeLabel}</span>
          <div className="flex items-center gap-2">
            {bilder.length > 1 && (
              <button
                onClick={() => setGallery({ bilder, index: 0 })}
                className="flex items-center gap-1 text-xs font-bold opacity-90 bg-white/20 px-2 py-0.5 rounded-full"
              >
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

        {/* Bild */}
        {bilder.length > 0 && (
          <button
            className="relative w-full cursor-pointer"
            onClick={() => setGallery({ bilder, index: 0 })}
            aria-label={`Bildergalerie öffnen (${bilder.length} ${bilder.length === 1 ? 'Bild' : 'Bilder'})`}
          >
            <img src={bilder[0]} alt={post.titel} className="w-full aspect-[4/3] object-cover" />
            {bilder.length > 1 && (
              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                <Images className="w-3 h-3" aria-hidden="true" /> {bilder.length}
              </div>
            )}
          </button>
        )}

        {/* Inhalt */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className={clsx('text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wide', tagMeta.color)}>
              {tagMeta.label}
            </span>
            <span className="text-xs text-gray-500 ml-auto">
              {post.published_at ? formatDistanceToNow(new Date(post.published_at), { addSuffix: true, locale: de }) : ''}
            </span>
            <ReportButton inhaltTyp="post" inhaltId={post.id} />
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

          {post.sammlung_datum && (
            <div className="mt-2 px-3 py-2 bg-emerald-50 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-sm text-emerald-700 font-bold">
                  {format(new Date(post.sammlung_datum), 'EEEE, d. MMMM yyyy · HH:mm', { locale: de })} Uhr
                </span>
              </div>
              {post.sammlung_organisator && (
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-sm text-emerald-700">{post.sammlung_organisator}</span>
                </div>
              )}
            </div>
          )}

          <button onClick={onToggleExpand} className="w-full text-left" aria-expanded={expanded}>
            <p className={clsx('text-gray-600 text-sm mt-2 leading-relaxed whitespace-pre-wrap', !expanded && 'line-clamp-3')}>
              {renderRichText(post.inhalt)}
            </p>
            {!expanded && (
              <span className="text-xs text-primary-500 font-semibold mt-1 block">Mehr lesen</span>
            )}
          </button>

          {/* Footer */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
            <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-black text-primary-700 shrink-0">
              {personName[0]?.toUpperCase()}
            </div>
            <span className="text-xs text-gray-500 font-medium flex-1 truncate">{personName}</span>
            <ShareButton
              postId={post.id}
              titel={post.titel}
              inhalt={post.inhalt}
              gemeindeName={gemeindeName}
            />
          </div>
        </div>
      </article>

      {gallery && (
        <GalleryLightbox
          bilder={gallery.bilder}
          startIndex={gallery.index}
          onClose={() => setGallery(null)}
        />
      )}
    </>
  )
}
