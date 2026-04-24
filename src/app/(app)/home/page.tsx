import { createClient } from '@/lib/supabase/server'
import { Newspaper, AlertTriangle, ShoppingBag, BarChart2, MessageCircleQuestion, LayoutDashboard, CalendarDays } from 'lucide-react'
import Link from 'next/link'

const tiles = [
  { href: '/feed',             label: 'Newsfeed',         icon: Newspaper,            color: 'bg-primary-500',  desc: 'Aktuelles aus der Gemeinde' },
  { href: '/veranstaltungen',  label: 'Veranstaltungen',  icon: CalendarDays,          color: 'bg-purple-500',   desc: 'Events & Termine' },
  { href: '/maengel',          label: 'Mängel melden',    icon: AlertTriangle,         color: 'bg-red-500',      desc: 'Schäden und Probleme melden' },
  { href: '/umfragen',         label: 'Umfragen',         icon: BarChart2,             color: 'bg-violet-500',   desc: 'Ihre Meinung zählt' },
  { href: '/marktplatz',       label: 'Marktplatz',       icon: ShoppingBag,           color: 'bg-orange-500',   desc: 'Lokale Angebote & Gesuche' },
  { href: '/buergermeister',   label: 'Frag den BM',      icon: MessageCircleQuestion, color: 'bg-sky-500',      desc: 'Direkt an die Verwaltung' },
]

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, role, gemeinden(name)')
    .eq('id', user?.id ?? '')
    .single()

  const hasDashboard = profile?.role === 'verwaltung' || profile?.role === 'super_admin' || profile?.role === 'verein'
  const gemeindeName = (profile?.gemeinden as unknown as { name: string } | null)?.name ?? 'Ehningen'
  const vorname = profile?.display_name?.split(' ')[0] ?? 'Hallo'

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      {/* Header */}
      <div className="bg-primary-500 px-5 pt-14 pb-8">
        <p className="text-primary-200 text-xs font-bold tracking-[0.2em] uppercase">{gemeindeName}</p>
        <h1 className="text-white font-black text-2xl mt-1">Hallo, {vorname}!</h1>
        <p className="text-primary-200 text-sm mt-0.5">Was möchtest du heute tun?</p>
      </div>

      {/* Kacheln */}
      <div className="px-4 py-5 grid grid-cols-2 gap-3">
        {hasDashboard && (
          <Link href="/dashboard"
            className="col-span-2 bg-gray-900 rounded-2xl p-5 flex items-center gap-4 shadow-sm active:opacity-90">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <LayoutDashboard className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white font-black text-base">Dashboard</p>
              <p className="text-gray-400 text-xs mt-0.5">Verwaltung & Übersicht</p>
            </div>
          </Link>
        )}

        {tiles.map(({ href, label, icon: Icon, color, desc }) => (
          <Link key={href} href={href}
            className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3 active:opacity-90">
            <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-black text-gray-900 text-sm leading-tight">{label}</p>
              <p className="text-gray-400 text-xs mt-0.5 leading-tight">{desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
