'use client'

import { useState } from 'react'
import { Bell, Globe, Users } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'
import { cn } from '@/lib/cn'
import { PageHeader } from '@/components/ui'
import { renderRichText } from '@/lib/richText'
import type { VereinMitKategorie } from '@/types/database'
import type { VereinPost } from '@/lib/verein'

interface Props {
  verein: VereinMitKategorie
  posts: VereinPost[]
  istAbonniert: boolean
  abonnentenAnzahl: number
}

export default function VereinProfil({ verein, posts, istAbonniert: initialAbonniert, abonnentenAnzahl: initialAnzahl }: Props) {
  const [abonniert, setAbonniert]   = useState(initialAbonniert)
  const [anzahl, setAnzahl]         = useState(initialAnzahl)
  const [loading, setLoading]       = useState(false)

  const isOrg    = verein.typ === 'organisation'
  const bgLight  = isOrg ? 'bg-teal-100'   : 'bg-violet-100'
  const iconText = isOrg ? 'text-teal-500' : 'text-violet-600'
  const badgeBg  = isOrg ? 'bg-teal-500'   : 'bg-violet-600'

  async function toggleAbonnement() {
    setLoading(true)
    try {
      const res = await fetch('/api/verein/abonnieren', {
        method: abonniert ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vereinId: verein.id }),
      })
      if (!res.ok) throw new Error()
      setAbonniert(a => !a)
      setAnzahl(n => n + (abonniert ? -1 : 1))
      toast.success(abonniert ? 'Abonnement gekündigt' : `${verein.verein_name} abonniert`)
    } catch {
      toast.error('Fehler beim Aktualisieren')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <PageHeader gemeindeName="" title={verein.verein_name} showBack />

      <div className="p-4 space-y-4 pt-4">
        {/* Kopfbereich */}
        <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(15,45,107,0.08)] p-5">
          <div className="flex items-start gap-4">
            {verein.logo_url ? (
              <img src={verein.logo_url} alt={verein.verein_name} className="w-20 h-20 rounded-2xl object-cover shrink-0" />
            ) : (
              <div className={cn('w-20 h-20 rounded-2xl flex items-center justify-center shrink-0', bgLight)}>
                <Users className={cn('w-10 h-10', iconText)} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="font-black text-gray-900 text-lg leading-tight">{verein.verein_name}</h1>
              {verein.verein_kategorien?.name && (
                <p className={cn('text-xs font-bold mt-0.5', iconText)}>{verein.verein_kategorien.name}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <Users className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs text-gray-500 font-medium">{anzahl} Abonnenten</span>
              </div>
            </div>
          </div>

          {verein.beschreibung && (
            <p className="text-sm text-gray-600 mt-4 leading-relaxed">{verein.beschreibung}</p>
          )}

          <div className="flex flex-col gap-2 mt-4">
            {verein.website && (
              <a
                href={verein.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary-600 font-medium"
              >
                <Globe className="w-4 h-4 shrink-0" />
                <span className="truncate">{verein.website.replace(/^https?:\/\//, '')}</span>
              </a>
            )}
          </div>

          <button
            onClick={toggleAbonnement}
            disabled={loading}
            className={cn(
              'mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-colors',
              abonniert
                ? `${badgeBg} text-white`
                : 'bg-gray-100 text-gray-700',
            )}
          >
            <Bell className="w-4 h-4" />
            {abonniert ? 'Abonniert' : 'Abonnieren'}
          </button>
        </div>

        {/* Beiträge */}
        {posts.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Beiträge</p>
            {posts.map(post => (
              <div key={post.id} className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(15,45,107,0.08)] overflow-hidden">
                {post.bild_url && (
                  <img src={post.bild_url} alt={post.titel} className="w-full h-40 object-cover" />
                )}
                <div className="p-4">
                  <h3 className="font-black text-gray-900 text-sm uppercase tracking-wide">{post.titel}</h3>
                  <p className="text-sm text-gray-600 mt-1 leading-relaxed line-clamp-3">
                    {renderRichText(post.inhalt)}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    {formatDistanceToNow(new Date(post.published_at), { addSuffix: true, locale: de })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {posts.length === 0 && (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-400 text-sm shadow-[0_2px_14px_rgba(15,45,107,0.08)]">
            Noch keine Beiträge vorhanden
          </div>
        )}
      </div>
    </div>
  )
}
