import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getGemeinde } from '@/lib/gemeinde'
import BottomNav from '@/components/layout/BottomNav'
import PushNotificationInit from '@/components/PushNotificationInit'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [profileResult, gemeinde] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    getGemeinde(),
  ])

  const profile = profileResult.data

  // Primärfarbe aus der Datenbank – Fallback auf Dorfly-Standard-Blau
  const primaryColor = gemeinde?.primary_color ?? '#0f2d6b'

  return (
    <div
      className="min-h-screen bg-[#F4F6F9]"
      style={{ '--color-primary': primaryColor } as React.CSSProperties}
    >
      {gemeinde?.slug && <PushNotificationInit userId={user.id} gemeindeSlug={gemeinde.slug} />}
      <main id="main-content" tabIndex={-1} className="max-w-lg mx-auto pb-20 outline-none">
        {children}
      </main>
      <BottomNav role={profile?.role} />
    </div>
  )
}
