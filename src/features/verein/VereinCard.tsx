'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Users, Bell } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import type { VereinMitKategorie } from '@/types/database'

interface VereinCardProps {
  verein: VereinMitKategorie
  istAbonniert: boolean
  className?: string
}

const COLOR = {
  verein:       { bg: 'bg-violet-100', icon: 'text-violet-500', badge: 'bg-violet-500' },
  organisation: { bg: 'bg-teal-100',   icon: 'text-teal-500',   badge: 'bg-teal-500'   },
}

export function VereinCard({ verein, istAbonniert: initialAbonniert, className }: VereinCardProps) {
  const [abonniert, setAbonniert] = useState(initialAbonniert)
  const [loading, setLoading]     = useState(false)

  const colors = COLOR[verein.typ as 'verein' | 'organisation'] ?? COLOR.verein

  async function toggleAbonnement(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
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
    <Link
      href={`/vereine/${verein.id}`}
      className={cn(
        'block bg-white rounded-2xl shadow-[0_2px_14px_rgba(15,45,107,0.08)] overflow-hidden active:scale-[0.98] transition-transform',
        className,
      )}
    >
      <div className="flex items-center gap-4 p-4">
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

        <button
          onClick={toggleAbonnement}
          disabled={loading}
          className={cn(
            'shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors',
            abonniert ? colors.badge + ' text-white' : 'bg-gray-100 text-gray-400',
          )}
        >
          <Bell className="w-4 h-4" />
        </button>
      </div>
    </Link>
  )
}
