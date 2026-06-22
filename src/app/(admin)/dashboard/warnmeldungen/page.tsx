// src/app/(admin)/dashboard/warnmeldungen/page.tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { ShieldAlert, Plus, Clock } from 'lucide-react'
import { SEVERITY_LABEL, SEVERITY_COLOR, type WarnSeverity } from '@/features/warnmeldungen/types'
import DeactivateButton from './DeactivateButton'

export const metadata = { title: 'Warnmeldungen – Dashboard' }

export default async function WarnmeldungenAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, gemeinde_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'verwaltung') redirect('/dashboard')

  const service = await createServiceClient()

  type WarnRow = { id: string; titel: string; severity: number | null; is_active: boolean; dwd_id: string | null; created_at: string }
  const { data: warnmeldungen } = await (service.from('posts') as any)
    .select('id, titel, severity, is_active, dwd_id, created_at')
    .eq('gemeinde_id', profile.gemeinde_id!)
    .eq('channel', 'warnung')
    .order('created_at', { ascending: false }) as { data: WarnRow[] | null }

  const aktive = (warnmeldungen ?? []).filter((w) => w.is_active)
  const inaktive = (warnmeldungen ?? []).filter((w) => !w.is_active)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 pt-8 pb-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Warnmeldungen</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manuelle und DWD-Warnmeldungen verwalten</p>
          </div>
          <Link
            href="/dashboard/warnmeldungen/neu"
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Neue Warnmeldung
          </Link>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {aktive.length > 0 && (
          <section aria-label="Aktive Warnmeldungen">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
              Aktiv ({aktive.length})
            </h2>
            <div className="space-y-3">
              {aktive.map((w) => (
                <WarnCard key={w.id} w={w as any} />
              ))}
            </div>
          </section>
        )}

        {aktive.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <ShieldAlert className="w-10 h-10 mx-auto mb-3 opacity-40" aria-hidden="true" />
            <p className="text-sm">Keine aktiven Warnmeldungen</p>
          </div>
        )}

        {inaktive.length > 0 && (
          <section aria-label="Inaktive Warnmeldungen">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
              Inaktiv / Archiv ({inaktive.length})
            </h2>
            <div className="space-y-3">
              {inaktive.map((w) => (
                <WarnCard key={w.id} w={w as any} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function WarnCard({
  w,
}: {
  w: {
    id: string
    titel: string
    severity: number | null
    is_active: boolean
    dwd_id: string | null
    created_at: string
  }
}) {
  const sev = (w.severity ?? 2) as WarnSeverity
  const color = SEVERITY_COLOR[sev]
  const label = SEVERITY_LABEL[sev]
  const quelle = w.dwd_id ? 'DWD (automatisch)' : 'Manuell'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-start gap-4">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}18` }}
      >
        <ShieldAlert className="w-5 h-5" style={{ color }} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-gray-900 leading-snug">{w.titel}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ color, background: `${color}18` }}
          >
            {label}
          </span>
          <span className="text-xs text-gray-400">{quelle}</span>
          <span className="text-xs text-gray-300">·</span>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" aria-hidden="true" />
            {new Date(w.created_at).toLocaleDateString('de-DE')}
          </span>
        </div>
      </div>
      {w.is_active && w.dwd_id === null && (
        <DeactivateButton postId={w.id} />
      )}
    </div>
  )
}
