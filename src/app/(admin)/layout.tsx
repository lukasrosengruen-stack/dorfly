import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SidebarNav from '@/components/layout/SidebarNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, gemeinden(name)')
    .eq('id', user.id)
    .single()

  if (!profile || !['verwaltung', 'super_admin', 'verein', 'organisation'].includes(profile.role)) {
    redirect('/feed')
  }

  const gemeindeName = (profile.gemeinden as unknown as { name: string } | null)?.name

  return (
    <div className="flex min-h-screen bg-gray-100">
      <SidebarNav gemeindeName={gemeindeName} role={profile.role} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
