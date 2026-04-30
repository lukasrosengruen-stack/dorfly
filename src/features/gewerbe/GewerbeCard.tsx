'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Building2, Bell } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import type { OrganisationMitBranche } from '@/types/database'

interface GewerbeCardProps {
  betrieb: OrganisationMitBranche
  istAbonniert: boolean
  className?: string
}

export function GewerbeCard({ betrieb, istAbonniert: initialAbonniert, className }: GewerbeCardProps) {
  const [abonniert, setAbonniert] = useState(initialAbonniert)
  const [loading, setLoading] = useState(false)

  async function toggleAbonnement(e: React.MouseEvent) {
    e.preventDefault()
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
    <Link
      href={`/lokale-angebote/${betrieb.id}`}
      className={cn(
        'block bg-white rounded-2xl shadow-[0_2px_14px_rgba(15,45,107,0.08)] overflow-hidden active:scale-[0.98] transition-transform',
        className,
      )}
    >
      <div className="flex items-center gap-4 p-4">
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

        <button
          onClick={toggleAbonnement}
          disabled={loading}
          className={cn(
            'shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors',
            abonniert ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-400',
          )}
        >
          <Bell className="w-4 h-4" />
        </button>
      </div>
    </Link>
  )
}
