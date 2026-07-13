import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getGemeinde } from '@/lib/gemeinde'
import BottomNav from '@/components/layout/BottomNav'
import AppInit from '@/components/AppInit'
import { getFeatures, getBuergermeisterLabel } from '@/lib/features'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [profileResult, gemeinde] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    getGemeinde(),
  ])

  const profile = profileResult.data
  const features = getFeatures(gemeinde)
  const { short: buergermeisterShortLabel } = getBuergermeisterLabel(gemeinde)

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <main id="main-content" tabIndex={-1} className="max-w-lg mx-auto pb-20 outline-none">
        {children}
      </main>
      <AppInit />
      <BottomNav
        role={profile?.role}
        features={features}
        buergermeisterShortLabel={buergermeisterShortLabel}
      />
    </div>
  )
}
