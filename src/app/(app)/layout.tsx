import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getGemeinde } from '@/lib/gemeinde'
import { zielFuerFremdeGemeinde } from '@/lib/gemeindeWeiche'
import BottomNav from '@/components/layout/BottomNav'
import AppInit from '@/components/AppInit'
import LoginWall from '@/components/LoginWall'
import { GuestProvider } from '@/lib/guestContext'
import { getFeatures, getBuergermeisterLabel } from '@/lib/features'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isGuest = !user

  const [profileResult, gemeinde, h] = await Promise.all([
    user
      ? supabase.from('profiles').select('role, gemeinden(slug)').eq('id', user.id).single()
      : Promise.resolve({ data: null }),
    getGemeinde(),
    headers(),
  ])

  const profile = profileResult.data

  const host = h.get('host') ?? ''
  const ziel = zielFuerFremdeGemeinde({
    host,
    hostSlug: h.get('x-gemeinde-slug'),
    proto: h.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https'),
    profilSlug: (profile?.gemeinden as { slug?: string } | null)?.slug,
    role: profile?.role,
  })
  if (ziel) redirect(ziel)
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
