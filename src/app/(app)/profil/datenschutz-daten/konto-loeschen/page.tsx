'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function KontoLoeschenPage() {
  const router = useRouter()
  const supabase = createClient()
  const [showDialog, setShowDialog] = useState(false)
  const [loading, setLoading] = useState(false)

  async function deleteAccount() {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/loeschen', { method: 'DELETE' })
      if (res.ok) {
        await supabase.auth.signOut()
        router.push('/login')
      } else {
        const body = await res.json().catch(() => ({}))
        toast.error('Fehler: ' + (body.error ?? res.status))
        setShowDialog(false)
      }
    } catch {
      toast.error('Fehler beim Löschen')
      setShowDialog(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 flex items-center gap-3">
        <Link href="/profil/datenschutz-daten" className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Konto löschen</h1>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <p className="text-sm text-gray-700 leading-relaxed">
            Wenn Sie Ihr Konto löschen, werden alle Ihre persönlichen Daten unwiderruflich entfernt.
            Dieser Vorgang kann nicht rückgängig gemacht werden.
          </p>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Was wird gelöscht</p>
            {['Profildaten und persönliche Angaben', 'Erstellte Beiträge', 'Abonnements (Vereine & Gewerbe)'].map(item => (
              <div key={item} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
                <span className="text-sm text-gray-600">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => setShowDialog(true)}
          className="w-full py-3 rounded-xl bg-gray-100 text-gray-500 text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          Konto unwiderruflich löschen
        </button>
      </div>

      {showDialog && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl p-6 space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-gray-900">Wirklich löschen?</h2>
              <p className="text-sm text-gray-500">Ihr Konto und alle Daten werden dauerhaft gelöscht.</p>
            </div>
            <button
              onClick={() => setShowDialog(false)}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-primary-500 text-white font-semibold text-sm disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              onClick={deleteAccount}
              disabled={loading}
              className="w-full py-2 text-gray-400 text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Endgültig löschen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
