import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Shield, Database, Download } from 'lucide-react'
import { ZurueckButton } from '@/components/ui'
import DownloadButton from './DownloadButton'

export const metadata: Metadata = { title: 'Datenschutz & Daten – Dorfly' }

export default async function DatenschutzDatenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* pt-safe-header statt pt-12 wegen Notch/Dynamic Island */}
      <div className="bg-white border-b border-gray-100 px-4 pt-safe-header pb-4 flex items-center gap-2">
        <ZurueckButton fallback="/profil" variant="dunkel" label={false} />
        <h1 className="text-xl font-bold text-gray-900">Datenschutz & Daten</h1>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <Link href="/profil/datenschutz-daten/meine-daten"
            className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors border-b border-gray-50">
            <Database className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="text-sm font-medium text-gray-700 flex-1">Meine Daten einsehen</span>
            <span className="text-gray-300">›</span>
          </Link>
          <DownloadButton />
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <Link href="/profil/datenschutz-daten/konto-loeschen"
            className="flex items-center px-4 py-3.5 hover:bg-gray-50 transition-colors">
            <span className="text-sm text-gray-400 flex-1">Konto löschen</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
