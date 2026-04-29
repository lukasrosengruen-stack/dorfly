'use client'

/**
 * MangelKarte – Einzelne Mängelanzeige (Bürger-Ansicht)
 *
 * Zeigt Status, Beschreibung, optionales Foto und Verwaltungs-Nachricht.
 */
import { clsx } from 'clsx'
import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'
import { AlertTriangle, Clock, CheckCircle2 } from 'lucide-react'
import { Mangel, MaengelStatus } from '@/types/database'

const STATUS_META: Record<MaengelStatus, { label: string; color: string; icon: React.ElementType }> = {
  offen:          { label: 'Offen',          color: 'text-red-600 bg-red-50',     icon: AlertTriangle },
  in_bearbeitung: { label: 'In Bearbeitung', color: 'text-amber-600 bg-amber-50', icon: Clock },
  erledigt:       { label: 'Erledigt',       color: 'text-green-600 bg-green-50', icon: CheckCircle2 },
}

interface MangelKarteProps {
  mangel: Mangel
}

export function MangelKarte({ mangel: m }: MangelKarteProps) {
  const meta = STATUS_META[m.status]
  const Icon = meta.icon

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(15,45,107,0.08)] overflow-hidden">
      {m.foto_url && (
        <img src={m.foto_url} alt={m.titel} className="w-full h-36 object-cover" />
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-900">{m.titel}</h3>
          <span className={clsx('flex items-center gap-1 text-xs px-2 py-1 rounded-full shrink-0', meta.color)}>
            <Icon className="w-3 h-3" />
            {meta.label}
          </span>
        </div>

        {m.beschreibung && (
          <p className="text-sm text-gray-500 mt-1">{m.beschreibung}</p>
        )}

        {m.nachricht_an_buerger && (
          <div className="mt-3 bg-primary-50 border border-primary-100 rounded-xl p-3">
            <p className="text-xs font-semibold text-primary-600 mb-1">Nachricht der Verwaltung</p>
            <p className="text-sm text-gray-700">{m.nachricht_an_buerger}</p>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-2">
          {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: de })}
        </p>
      </div>
    </div>
  )
}
