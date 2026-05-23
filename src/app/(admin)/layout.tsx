import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getGemeinde } from '@/lib/gemeinde'
import SidebarNav from '@/components/layout/SidebarNav'
import { getBuergermeisterLabel } from '@/lib/features'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [profileResult, gemeinde] = await Promise.all([
    supabase.from('profiles').select('role, gemeinden(name)').eq('id', user.id).single(),
    getGemeinde(),
  ])

  const profile = profileResult.data

  if (!profile || !['verwaltung', 'super_admin', 'verein', 'organisation', 'gemeinderat'].includes(profile.role)) {
    redirect('/feed')
  }

  const gemeindeName = (profile.gemeinden as unknown as { name: string } | null)?.name
  const { long: buergermeisterLongLabel } = getBuergermeisterLabel(gemeinde)

  return (
    <div className="flex min-h-screen bg-gray-100">
      <SidebarNav
        gemeindeName={gemeindeName}
        role={profile.role}
        buergermeisterLongLabel={buergermeisterLongLabel}
      />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
