'use client'

import { useEffect, useState } from 'react'
import { Building2, Bell, ChevronDown, Globe, MapPin, Clock, Users } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'
import { cn } from '@/lib/cn'
import type { OrganisationMitBranche, Post } from '@/types/database'

interface GewerbeCardProps {
  betrieb: OrganisationMitBranche
  istAbonniert: boolean
  expanded: boolean
  onToggleExpand: () => void
  className?: string
}

interface GewerbeDetailData {
  posts: Post[]
  abonnentenAnzahl: number
}

export function GewerbeCard({ betrieb, istAbonniert: initialAbonniert, expanded, onToggleExpand, className }: GewerbeCardProps) {
  const [abonniert, setAbonniert] = useState(initialAbonniert)
  const [loading, setLoading]     = useState(false)
  const [detail, setDetail]       = useState<GewerbeDetailData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    if (!expanded || detail || detailLoading) return
    setDetailLoading(true)
    fetch(`/api/gewerbe/${betrieb.id}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => setDetail({ posts: data.posts, abonnentenAnzahl: data.abonnentenAnzahl }))
      .catch(() => toast.error('Details konnten nicht geladen werden'))
      .finally(() => setDetailLoading(false))
  }, [expanded, detail, detailLoading, betrieb.id])

  async function toggleAbonnement(e: React.MouseEvent) {
    e.stopPropagation()
    setLoading(true)
    try {
      const res = await fetch('/api/gewerbe/abonnieren', {
        method: abonniert ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gewerbeId: betrieb.id }),
      })
      if (!res.ok) throw new Error()
      setAbonniert(a => !a)
      toast.success(abonniert ? 'Abonnement gekündigt' : `${betrieb.name} abonniert`)
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
          {betrieb.logo_url ? (
            <img
              src={betrieb.logo_url}
              alt={betrieb.name}
              className="w-14 h-14 rounded-xl object-cover shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
              <Building2 className="w-7 h-7 text-orange-500" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-gray-900 text-sm uppercase tracking-wide truncate">
                {betrieb.name}
              </h3>
              {betrieb.verified && (
                <span className="shrink-0 text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                  Verifiziert
                </span>
              )}
            </div>

            {betrieb.gewerbe_branchen?.name && (
              <p className="text-xs text-orange-600 font-semibold mt-0.5">{betrieb.gewerbe_branchen.name}</p>
            )}

            {betrieb.beschreibung && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{betrieb.beschreibung}</p>
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
          aria-label={abonniert ? `${betrieb.name} nicht mehr abonnieren` : `${betrieb.name} abonnieren`}
          className={cn(
            'shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors',
            abonniert ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-400',
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
              {betrieb.beschreibung && (
                <p className="text-sm text-gray-600 leading-relaxed">{betrieb.beschreibung}</p>
              )}

              <div className="space-y-2">
                {betrieb.adresse && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" aria-hidden="true" />
                    <span className="text-xs text-gray-600">{betrieb.adresse}</span>
                  </div>
                )}
                {betrieb.oeffnungszeiten && (
                  <div className="flex items-start gap-2">
                    <Clock className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" aria-hidden="true" />
                    <span className="text-xs text-gray-600 whitespace-pre-line">{betrieb.oeffnungszeiten}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                {betrieb.website && (
                  <a
                    href={betrieb.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-primary-600 font-semibold min-w-0"
                  >
                    <Globe className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{betrieb.website.replace(/^https?:\/\//, '')}</span>
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
                        <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">{post.inhalt}</p>
                        <p className="text-[11px] text-gray-400 mt-1.5">
                          {post.published_at ? formatDistanceToNow(new Date(post.published_at), { addSuffix: true, locale: de }) : ''}
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
