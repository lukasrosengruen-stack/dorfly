'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function DownloadButton() {
  const [loading, setLoading] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const supabase = createClient()

  async function handleDownload() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [
        { data: profile },
        { data: posts },
        { data: gewerbeAbo },
        { data: vereinAbo },
        { data: maengel },
        { data: teilnahmen },
      ] = await Promise.all([
        supabase.from('profiles').select('*, gemeinden(name)').eq('id', user.id).single(),
        supabase.from('posts').select('id, titel, channel, created_at').eq('author_id', user.id),
        supabase.from('gewerbe_abonnements').select('organisationen(name)').eq('user_id', user.id),
        supabase.from('verein_abonnements').select('vereine(verein_name)').eq('user_id', user.id),
        supabase.from('maengel').select('id, titel, status, created_at').eq('melder_id', user.id),
        supabase.from('umfrage_teilnahmen').select('umfrage_id, created_at').eq('user_id', user.id),
      ])

      const daten = {
        exportiertAm: new Date().toISOString(),
        profil: {
          email: user.email,
          name: profile?.display_name,
          gemeinde: (profile?.gemeinden as { name: string } | null)?.name,
          rolle: profile?.role,
          registriertAm: user.created_at,
        },
        beitraege: posts ?? [],
        abonniertesGewerbe: (gewerbeAbo ?? []).map((a: { organisationen: unknown }) => a.organisationen),
        abonniertVereine: (vereinAbo ?? []).map((a: { vereine: unknown }) => a.vereine),
        gemeldeteManegel: maengel ?? [],
        umfrageTeilnahmen: teilnahmen ?? [],
      }

      const datum = new Date().toISOString().split('T')[0]
      const filename = `dorfly-meine-daten-${datum}.json`
      const json = JSON.stringify(daten, null, 2)
      const blob = new Blob([json], { type: 'application/json' })

      if (navigator.canShare?.({ files: [new File([blob], filename, { type: 'application/json' })] })) {
        await navigator.share({ files: [new File([blob], filename, { type: 'application/json' })] })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
      }

      toast.success('Datei erfolgreich exportiert')
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') {
        toast.error('Export fehlgeschlagen')
      }
    } finally {
      setLoading(false)
      setShowHint(false)
    }
  }

  if (showHint) {
    return (
      <div className="px-4 py-4 space-y-3 border-t border-gray-50">
        <p className="text-xs text-gray-500 leading-relaxed">
          Sie erhalten eine Datei mit allen bei Dorfly gespeicherten Daten zu Ihrer Person.
          Diese Funktion dient Ihrem Auskunftsrecht gemäß Art. 15 DSGVO.
        </p>
        <div className="flex gap-2">
          <button onClick={() => setShowHint(false)}
            className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-500">
            Abbrechen
          </button>
          <button onClick={handleDownload} disabled={loading}
            className="flex-1 py-2 rounded-xl bg-primary-500 text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Herunterladen
          </button>
        </div>
      </div>
    )
  }

  return (
    <button onClick={() => setShowHint(true)}
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors text-left">
      <Download className="w-4 h-4 text-gray-400 shrink-0" />
      <span className="text-sm font-medium text-gray-700 flex-1">Meine Daten herunterladen</span>
      <span className="text-gray-300">›</span>
    </button>
  )
}
