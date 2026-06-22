// src/app/(admin)/dashboard/warnmeldungen/neu/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import WarnmeldungForm from '../WarnmeldungForm'

export const metadata = { title: 'Neue Warnmeldung – Dashboard' }

export default async function NeueWarnmeldungPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'verwaltung') redirect('/dashboard')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 pt-8 pb-5">
        <h1 className="text-2xl font-bold text-gray-900">Neue Warnmeldung</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manuelle Warnung für die Bürger erstellen</p>
      </div>
      <div className="px-8 py-6">
        <WarnmeldungForm />
      </div>
    </div>
  )
}
