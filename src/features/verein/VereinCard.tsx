'use client'

import { useEffect, useState } from 'react'
import { Users, Bell, ChevronDown, Globe } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'
import { cn } from '@/lib/cn'
import { renderRichText } from '@/lib/richText'
import type { VereinMitKategorie } from '@/types/database'
import type { VereinPost } from '@/lib/verein'
import { useGuestGuard } from '@/hooks/useGuestGuard'

interface VereinCardProps {
  verein: VereinMitKategorie
  istAbonniert: boolean
  expanded: boolean
  onToggleExpand: () => void
  className?: string
}

interface VereinDetailData {
  posts: VereinPost[]
  abonnentenAnzahl: number
}

const COLOR = {
  verein:       { bg: 'bg-violet-100', icon: 'text-violet-500', badge: 'bg-violet-500' },
  organisation: { bg: 'bg-teal-100',   icon: 'text-teal-500',   badge: 'bg-teal-500'   },
}

export function VereinCard({ verein, istAbonniert: initialAbonniert, expanded, onToggleExpand, className }: VereinCardProps) {
  const [abonniert, setAbonniert] = useState(initialAbonniert)
  const [loading, setLoading]     = useState(false)
  const [detail, setDetail]       = useState<VereinDetailData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const { requireLogin } = useGuestGuard()

  const colors = COLOR[verein.typ as 'verein' | 'organisation'] ?? COLOR.verein

  useEffect(() => {
    if (!expanded || detail || detailLoading) return
    setDetailLoading(true)
    fetch(`/api/verein/${verein.id}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => setDetail({ posts: data.posts, abonnentenAnzahl: data.abonnentenAnzahl }))
      .catch(() => toast.error('Details konnten nicht geladen werden'))
      .finally(() => setDetailLoading(false))
  }, [expanded, detail, detailLoading, verein.id])

  async function toggleAbonnement(e: React.MouseEvent) {
    e.stopPropagation()
    if (requireLogin()) return
    setLoading(true)
    try {
      const res = await fetch('/api/verein/abonnieren', {
        method: abonniert ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vereinId: verein.id }),
      })
      if (!res.ok) throw new Error()
      setAbonniert(a => !a)
      toast.success(abonniert ? 'Abonnement gekündigt' : `${verein.verein_name} abonniert`)
    } catch {
      toast.error('Fehler beim Aktualisieren')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className={cn(
        'bg-white rounded-2xl shadow-[0_2px_14px_rgba(15,45,107,0.08)] overflow-hidden',
        className,
      )}
    >
      <div className="flex items-center gap-4 p-4">
        <button
          onClick={onToggleExpand}
          aria-expanded={expanded}
          className="flex items-center gap-4 flex-1 min-w-0 text-left active:scale-[0.98] transition-transform"
        >
          {verein.logo_url ? (
            <img
              src={verein.logo_url}
              alt={verein.verein_name}
              className="w-14 h-14 rounded-xl object-cover shrink-0"
            />
          ) : (
            <div className={cn('w-14 h-14 rounded-xl flex items-center justify-center shrink-0', colors.bg)}>
              <Users className={cn('w-7 h-7', colors.icon)} />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-gray-900 text-sm uppercase tracking-wide truncate">
                {verein.verein_name}
              </h3>
              {verein.verified && (
                <span className={cn('shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide text-white', colors.badge)}>
                  Verifiziert
                </span>
              )}
            </div>

            {verein.verein_kategorien?.name && (
              <p className={cn('text-xs font-semibold mt-0.5', colors.icon)}>
                {verein.verein_kategorien.name}
              </p>
            )}

            {verein.beschreibung && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{verein.beschreibung}</p>
            )}
          </div>

          <ChevronDown
            className={cn('w-4 h-4 text-gray-400 shrink-0 transition-transform', expanded && 'rotate-180')}
            aria-hidden="true"
          />
        </button>

        <button
          onClick={toggleAbonnement}
          disabled={loading}
          aria-label={abonniert ? `${verein.verein_name} nicht mehr abonnieren` : `${verein.verein_name} abonnieren`}
          className={cn(
            'shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors',
            abonniert ? colors.badge + ' text-white' : 'bg-gray-100 text-gray-400',
          )}
        >
          <Bell className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-3 border-t border-gray-100 space-y-3">
          {detailLoading && (
            <p className="text-xs text-gray-400 text-center py-4">Lädt …</p>
          )}

          {!detailLoading && detail && (
            <>
              {verein.beschreibung && (
                <p className="text-sm text-gray-600 leading-relaxed">{verein.beschreibung}</p>
              )}

              <div className="flex items-center gap-4 flex-wrap">
                {verein.website && (
                  <a
                    href={verein.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-primary-600 font-semibold min-w-0"
                  >
                    <Globe className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{verein.website.replace(/^https?:\/\//, '')}</span>
                  </a>
                )}
                <span className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                  <Users className="w-3.5 h-3.5" aria-hidden="true" />
                  {detail.abonnentenAnzahl} Abonnenten
                </span>
              </div>

              {detail.posts.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Beiträge</p>
                  {detail.posts.map(post => (
                    <div key={post.id} className="bg-gray-50 rounded-xl overflow-hidden">
                      {post.bild_url && (
                        <img src={post.bild_url} alt={post.titel} className="w-full h-32 object-cover" />
                      )}
                      <div className="p-3">
                        <h4 className="font-black text-gray-900 text-xs uppercase tracking-wide">{post.titel}</h4>
                        <p className="text-xs text-gray-600 mt-1 leading-relaxed line-clamp-3">
                          {renderRichText(post.inhalt)}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-1.5">
                          {formatDistanceToNow(new Date(post.published_at), { addSuffix: true, locale: de })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-3">Noch keine Beiträge vorhanden</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
