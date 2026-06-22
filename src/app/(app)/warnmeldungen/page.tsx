import type { Metadata } from 'next'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getGemeinde } from '@/lib/gemeinde'
import { SEVERITY_LABEL, SEVERITY_COLOR, SEVERITY_BG, type WarnSeverity } from '@/features/warnmeldungen/types'

export const metadata: Metadata = { title: 'Warnmeldungen – Dorfly' }

export default async function WarnmeldungenPage() {
  const [supabase, gemeinde] = await Promise.all([
    createClient(),
    getGemeinde(),
  ])

  const { data: warnmeldungen } = await supabase
    .from('posts')
    .select('id, titel, inhalt, severity, dwd_id, created_at, expires_at')
    .eq('gemeinde_id', gemeinde?.id ?? '')
    .eq('channel', 'warnung')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const liste = warnmeldungen ?? []

  return (
    <div className="min-h-screen bg-[#f5f7fc]">
      <div className="bg-red-600 px-6 pt-14 pb-6">
        <p className="text-[10px] font-bold tracking-[3px] text-red-200 uppercase">{gemeinde?.name}</p>
        <h1 className="text-white font-extrabold text-[28px] mt-1.5 leading-snug">
          Warnmeldungen
        </h1>
        <p className="text-white/60 text-[13px] mt-1.5">
          {liste.length > 0
            ? `${liste.length} aktive Warnung${liste.length !== 1 ? 'en' : ''}`
            : 'Keine aktiven Warnmeldungen'}
        </p>
      </div>

      <div className="px-4 py-4 space-y-3">
        {liste.length === 0 && (
          <div className="bg-white rounded-[18px] p-6 shadow-[0_2px_14px_rgba(15,45,107,0.08)] text-center">
            <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-green-500" aria-hidden="true" />
            <p className="font-semibold text-[#0f172a]">Alles in Ordnung</p>
            <p className="text-[13px] text-[#64748b] mt-1">
              Momentan gibt es keine Warnmeldungen für {gemeinde?.name ?? 'Ihre Gemeinde'}.
            </p>
          </div>
        )}

        {liste.map((w) => {
          const sev = ((w as any).severity ?? 2) as WarnSeverity
          const color = SEVERITY_COLOR[sev]
          const bg = SEVERITY_BG[sev]
          const label = SEVERITY_LABEL[sev]
          const quelle = (w as any).dwd_id ? 'Deutscher Wetterdienst' : 'Gemeindeverwaltung'

          return (
            <article
              key={w.id}
              className="bg-white rounded-[18px] p-4 shadow-[0_2px_14px_rgba(15,45,107,0.08)]"
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: bg }}
                >
                  <ShieldAlert className="w-5 h-5" style={{ color }} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                      style={{ color, background: bg }}
                    >
                      {label}
                    </span>
                    <span className="text-[11px] text-[#64748b]">{quelle}</span>
                  </div>
                  <p className="font-bold text-[14px] text-[#0f172a] leading-snug">{w.titel}</p>
                  {w.inhalt && (
                    <p className="text-[13px] text-[#475569] mt-2 leading-relaxed whitespace-pre-line">
                      {w.inhalt}
                    </p>
                  )}
                  <p className="text-[11px] text-[#94a3b8] mt-3">
                    {new Date(w.created_at).toLocaleString('de-DE', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                    {(w as any).expires_at && (
                      <> · Gültig bis {new Date((w as any).expires_at).toLocaleString('de-DE', {
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                      })}</>
                    )}
                  </p>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
