import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getGemeinde } from '@/lib/gemeinde'
import BottomNav from '@/components/layout/BottomNav'

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
      <main className="max-w-lg mx-auto pb-20">
        {children}
      </main>
      <BottomNav role={profile?.role} />
    </div>
  )
}
