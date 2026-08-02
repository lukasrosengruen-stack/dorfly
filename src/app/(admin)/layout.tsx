import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getGemeinde } from '@/lib/gemeinde'
import BottomNav from '@/components/layout/BottomNav'
import { getFeatures, getBuergermeisterLabel } from '@/lib/features'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [profileResult, gemeinde] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    getGemeinde(),
  ])

  const profile = profileResult.data

  if (!profile || !['verwaltung', 'super_admin', 'verein', 'organisation', 'gemeinderat'].includes(profile.role)) {
    redirect('/feed')
  }

  const features = getFeatures(gemeinde)
  const { short: buergermeisterShortLabel } = getBuergermeisterLabel(gemeinde)

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <main className="pb-nav">
        {children}
      </main>
      <BottomNav
        role={profile.role}
        features={features}
        buergermeisterShortLabel={buergermeisterShortLabel}
      />
    </div>
  )
}
