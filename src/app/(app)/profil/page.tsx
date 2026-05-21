import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfilClient from './ProfilClient'

export const metadata: Metadata = { title: 'Profil – Dorfly' }

export default async function ProfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, gemeinden(name, bundesland)')
    .eq('id', user.id)
    .single()

  return <ProfilClient profile={profile} email={user.email ?? null} />
}
