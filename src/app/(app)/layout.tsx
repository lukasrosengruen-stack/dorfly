import { createClient } from '@/lib/supabase/server'
import { getGemeinde } from '@/lib/gemeinde'
import BottomNav from '@/components/layout/BottomNav'
import AppInit from '@/components/AppInit'
import LoginWall from '@/components/LoginWall'
import { GuestProvider } from '@/lib/guestContext'
import { getFeatures, getBuergermeisterLabel } from '@/lib/features'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isGuest = !user

  const [profileResult, gemeinde] = await Promise.all([
    user
      ? supabase.from('profiles').select('role').eq('id', user.id).single()
      : Promise.resolve({ data: null }),
    getGemeinde(),
  ])

  const profile = profileResult.data
  const features = getFeatures(gemeinde)
  const { short: buergermeisterShortLabel } = getBuergermeisterLabel(gemeinde)

  return (
    <GuestProvider isGuest={isGuest}>
      <div className="min-h-screen bg-[#F4F6F9]">
        <main id="main-content" tabIndex={-1} className="max-w-lg mx-auto pb-nav outline-none">
          {children}
        </main>
        {!isGuest && <AppInit />}
        <BottomNav
          role={profile?.role}
          features={features}
          buergermeisterShortLabel={buergermeisterShortLabel}
          isGuest={isGuest}
        />
        <LoginWall />
      </div>
    </GuestProvider>
  )
}
