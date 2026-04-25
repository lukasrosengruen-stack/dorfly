import { createClient } from '@/lib/supabase/server'
import { Newspaper, AlertTriangle, ShoppingBag, BarChart2, MessageCircleQuestion, LayoutDashboard, CalendarDays } from 'lucide-react'
import Link from 'next/link'

const tiles = [
  { href: '/feed',            label: 'Newsfeed',         icon: Newspaper,            color: '#1a5cbf', bg: 'rgba(26,92,191,0.1)',  desc: 'Aktuelles' },
  { href: '/veranstaltungen', label: 'Veranstaltungen',  icon: CalendarDays,          color: '#7c3aed', bg: 'rgba(124,58,237,0.1)', desc: 'Events & Termine' },
  { href: '/maengel',         label: 'Mängel melden',    icon: AlertTriangle,         color: '#c41e1e', bg: 'rgba(196,30,30,0.1)',  desc: 'Schäden melden' },
  { href: '/umfragen',        label: 'Umfragen',         icon: BarChart2,             color: '#7c3aed', bg: 'rgba(124,58,237,0.1)', desc: 'Ihre Meinung' },
  { href: '/marktplatz',      label: 'Marktplatz',       icon: ShoppingBag,           color: '#ea580c', bg: 'rgba(234,88,12,0.1)',  desc: 'Angebote & Gesuche' },
  { href: '/buergermeister',  label: 'Frag den BM',      icon: MessageCircleQuestion, color: '#1a5cbf', bg: 'rgba(26,92,191,0.1)',  desc: 'An die Verwaltung' },
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
    <div className="min-h-screen bg-[#f5f7fc]">
      {/* Header */}
      <div className="bg-primary-500 px-6 pt-14 pb-6">
        <p className="text-[10px] font-bold tracking-[3px] text-gold-500 uppercase">{gemeindeName}</p>
        <h1 className="text-white font-extrabold text-[28px] mt-1.5 leading-snug">
          Guten Morgen,<br />{vorname}!
        </h1>
        <p className="text-white/60 text-[13px] mt-1.5">Was möchtest du heute tun?</p>
      </div>

      <div className="px-4 py-4 space-y-3">
        {/* Dashboard Banner */}
        {hasDashboard && (
          <Link href="/dashboard"
            className="bg-primary-500 rounded-[20px] p-4 flex items-center gap-4 shadow-[0_4px_14px_rgba(15,45,107,0.33)] active:opacity-90">
            <div className="w-11 h-11 rounded-[14px] bg-white/14 flex items-center justify-center shrink-0">
              <LayoutDashboard className="w-[22px] h-[22px] text-white" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-[14.5px]">Dashboard</p>
              <p className="text-white/55 text-xs mt-0.5">Verwaltung & Übersicht</p>
            </div>
            <div className="w-[30px] h-[30px] rounded-[9px] bg-gold-500 flex items-center justify-center shrink-0">
              <svg width="15" height="15" viewBox="0 0 22 22" fill="none">
                <path d="M4 11h14M13 5l6 6-6 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </Link>
        )}

        {/* Kachel-Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {tiles.map(({ href, label, icon: Icon, color, bg, desc }) => (
            <Link key={href} href={href}
              className="bg-white rounded-[18px] p-[15px_14px] shadow-[0_2px_14px_rgba(15,45,107,0.08)] flex flex-col gap-3 active:opacity-90">
              <div className="w-[58px] h-[58px] rounded-[18px] flex items-center justify-center"
                style={{ background: bg }}>
                <Icon className="w-[30px] h-[30px]" style={{ color }} strokeWidth={1.5} />
              </div>
              <div>
                <p className="font-bold text-[13px] text-[#0f172a] leading-tight">{label}</p>
                <p className="text-[11px] text-[#64748b] mt-0.5 leading-snug">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
