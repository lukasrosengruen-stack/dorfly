import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getGemeinde } from '@/lib/gemeinde'
import { Newspaper, AlertTriangle, BarChart2, MessageCircleQuestion, LayoutDashboard, CalendarDays, ExternalLink, ScrollText, Scale, UserCircle, Store, Trash2, Users, Phone, Globe, BookOpen, ShieldAlert, LucideIcon } from 'lucide-react'
import { isFeatureAktiv } from '@/lib/features'

export const metadata: Metadata = { title: 'Startseite – Dorfly' }
import Link from 'next/link'

interface Tile {
  href: string
  label: string
  icon: LucideIcon
  color: string
  bg: string
  desc: string
}

const BASE_TILES: Tile[] = [
  { href: '/feed',            label: 'Newsfeed',         icon: Newspaper,            color: '#1a5cbf', bg: 'rgba(26,92,191,0.1)',  desc: 'Aktuelles' },
  { href: '/veranstaltungen', label: 'Veranstaltungen',  icon: CalendarDays,          color: '#7c3aed', bg: 'rgba(124,58,237,0.1)', desc: 'Events & Termine' },
  { href: '/maengel',         label: 'Mängel melden',    icon: AlertTriangle,         color: '#c41e1e', bg: 'rgba(196,30,30,0.1)',  desc: 'Schäden melden' },
  { href: '/umfragen',        label: 'Umfragen',         icon: BarChart2,             color: '#7c3aed', bg: 'rgba(124,58,237,0.1)', desc: 'Ihre Meinung' },
  { href: '/lokale-angebote', label: 'Lokale Angebote',  icon: Store,                 color: '#ea580c', bg: 'rgba(234,88,12,0.1)',  desc: 'Betriebe vor Ort' },
  { href: '/vereine',         label: 'Vereine & Orgs',   icon: Users,                 color: '#7c3aed', bg: 'rgba(124,58,237,0.1)', desc: 'Vereine & Organisationen' },
  { href: '/buergermeister',  label: 'Frag den BM',      icon: MessageCircleQuestion, color: '#1a5cbf', bg: 'rgba(26,92,191,0.1)',  desc: 'An die Verwaltung' },
  { href: '/gemeinderat',     label: 'Gemeinderat',      icon: Scale,                 color: '#0f2d6b', bg: 'rgba(15,45,107,0.1)',  desc: 'Politik & Fragen' },
  { href: '/profil',          label: 'Mein Profil',      icon: UserCircle,            color: '#475569', bg: 'rgba(71,85,105,0.1)',  desc: 'Einstellungen & Konto' },
  { href: '/abfallkalender',  label: 'Abfallkalender',   icon: Trash2,                color: '#16a34a', bg: 'rgba(22,163,74,0.1)',  desc: 'Abfuhrtermine' },
  { href: '/warnmeldungen',   label: 'Warnmeldungen',    icon: ShieldAlert,           color: '#475569', bg: 'rgba(71,85,105,0.1)',  desc: 'Aktuelle Warnungen' },
]

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [profileResult, gemeinde] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name, role')
      .eq('id', user?.id ?? '')
      .single(),
    getGemeinde(),
  ])

  const { data: activeWarnung } = await (supabase.from('posts') as any)
    .select('id, titel, severity')
    .eq('gemeinde_id', gemeinde?.id ?? '')
    .eq('channel', 'warnung')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle() as { data: { id: string; titel: string; severity: number | null } | null }

  const profile = profileResult.data
  const hasDashboard = profile?.role === 'verwaltung' || profile?.role === 'super_admin' || profile?.role === 'verein' || profile?.role === 'organisation' || profile?.role === 'gemeinderat' || profile?.role === 'gewerbe'
  const dashboardHref = profile?.role === 'gewerbe' ? '/gewerbe/dashboard' : '/dashboard'
  const gemeindeName = gemeinde?.name ?? ''
  const vorname = profile?.display_name?.split(' ')[0] ?? 'Hallo'

  const FEATURE_GATE: Record<string, Parameters<typeof isFeatureAktiv>[1]> = {
    '/umfragen':        'umfragen',
    '/lokale-angebote': 'gewerbe',
    '/vereine':         'vereine',
    '/gemeinderat':     'gemeinderat',
    '/abfallkalender':  'abfallkalender',
    '/marktplatz':      'marktplatz',
  }

  const tiles = BASE_TILES.filter(({ href }) => {
    const featureKey = FEATURE_GATE[href]
    return featureKey ? isFeatureAktiv(gemeinde, featureKey) : true
  })

  const tilesWithWarn = tiles.map((t) =>
    t.href === '/warnmeldungen' && activeWarnung
      ? { ...t, color: '#dc2626', bg: 'rgba(220,38,38,0.1)' }
      : t,
  )

  return (
    <div className="min-h-screen bg-[#f5f7fc]">
      {/* Header */}
      <div className="bg-primary-500 px-6 pt-14 pb-6">
        <div className="flex items-center gap-3">
          {gemeinde?.logo_url && (
            <img
              src={gemeinde.logo_url}
              alt=""
              className="w-10 h-10 rounded-lg object-contain bg-white/10 p-1 shrink-0"
            />
          )}
          <div>
            <p className="text-[10px] font-bold tracking-[3px] text-gold-500 uppercase">{gemeindeName}</p>
            <h1 className="text-white font-extrabold text-[28px] mt-1.5 leading-snug">
              Guten Morgen,<br />{vorname}!
            </h1>
          </div>
        </div>
        <p className="text-white/60 text-[13px] mt-1.5">Was möchtest du heute tun?</p>
      </div>

      <div className="px-4 py-4 space-y-3">
        {/* Dashboard Banner */}
        {hasDashboard && (
          <Link href={dashboardHref}
            className="bg-primary-500 rounded-[20px] p-4 flex items-center gap-4 shadow-[0_4px_14px_rgba(15,45,107,0.33)] transition-[transform,box-shadow] duration-100 ease-out active:scale-[0.96] active:shadow-none">
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

        {/* Warnmeldungs-Banner — nur bei aktiver Warnung */}
        {activeWarnung && (
          <Link
            href="/warnmeldungen"
            aria-label={`Aktive Warnung: ${activeWarnung.titel}`}
            className="bg-red-600 rounded-[20px] p-4 flex items-center gap-4 shadow-[0_4px_14px_rgba(220,38,38,0.35)] transition-[transform,box-shadow] duration-100 ease-out active:scale-[0.96] active:shadow-none"
          >
            <div className="w-11 h-11 rounded-[14px] bg-white/20 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-[22px] h-[22px] text-white" strokeWidth={1.5} aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-[14.5px] leading-snug line-clamp-1">{activeWarnung.titel}</p>
              <p className="text-white/60 text-xs mt-0.5">Aktive Warnung · Details ansehen</p>
            </div>
            <div className="w-[30px] h-[30px] rounded-[9px] bg-white/20 flex items-center justify-center shrink-0">
              <svg width="15" height="15" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                <path d="M4 11h14M13 5l6 6-6 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </Link>
        )}

        {/* Kachel-Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {tilesWithWarn.map(({ href, label, icon: Icon, color, bg, desc }) => (
            <Link key={href} href={href}
              className="bg-white rounded-[18px] p-[15px_14px] shadow-[0_2px_14px_rgba(15,45,107,0.08)] flex flex-col gap-3 transition-[transform,box-shadow] duration-100 ease-out active:scale-[0.96] active:shadow-none">
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

        {/* Online-Dienste – nur anzeigen wenn mind. eine URL gesetzt */}
        {(gemeinde?.ratsinformation_url || gemeinde?.notfallnummern_url || (gemeinde as any)?.homepage_url || (gemeinde as any)?.mitteilungsblatt_url) && (
          <div>
            <p className="text-[11px] font-bold text-[#64748b] tracking-[1px] uppercase mb-2 px-1">Online-Dienste</p>
            <div className="grid grid-cols-2 gap-2.5">
              {(gemeinde as any)?.homepage_url && (
                <a href={(gemeinde as any).homepage_url} target="_blank" rel="noopener noreferrer"
                  className="bg-white rounded-[18px] p-[15px_14px] shadow-[0_2px_14px_rgba(15,45,107,0.08)] flex flex-col gap-3 transition-[transform,box-shadow] duration-100 ease-out active:scale-[0.96] active:shadow-none">
                  <div className="flex items-start justify-between">
                    <div className="w-[58px] h-[58px] rounded-[18px] flex items-center justify-center" style={{ background: 'rgba(26,92,191,0.08)' }}>
                      <Globe className="w-[30px] h-[30px]" style={{ color: '#1a5cbf' }} strokeWidth={1.5} />
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-[#64748b] mt-1" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="font-bold text-[13px] text-[#0f172a] leading-tight">Homepage</p>
                    <p className="text-[11px] text-[#64748b] mt-0.5 leading-snug">Gemeinde-Website</p>
                  </div>
                </a>
              )}
              {gemeinde?.ratsinformation_url && (
                <a href={gemeinde.ratsinformation_url} target="_blank" rel="noopener noreferrer"
                  className="bg-white rounded-[18px] p-[15px_14px] shadow-[0_2px_14px_rgba(15,45,107,0.08)] flex flex-col gap-3 transition-[transform,box-shadow] duration-100 ease-out active:scale-[0.96] active:shadow-none">
                  <div className="flex items-start justify-between">
                    <div className="w-[58px] h-[58px] rounded-[18px] flex items-center justify-center" style={{ background: 'rgba(15,45,107,0.08)' }}>
                      <ScrollText className="w-[30px] h-[30px]" style={{ color: '#0f2d6b' }} strokeWidth={1.5} />
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-[#64748b] mt-1" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="font-bold text-[13px] text-[#0f172a] leading-tight">Ratsinformationssystem</p>
                    <p className="text-[11px] text-[#64748b] mt-0.5 leading-snug">Sitzungen & Beschlüsse</p>
                  </div>
                </a>
              )}
              {gemeinde?.notfallnummern_url && (
                <a href={gemeinde.notfallnummern_url} target="_blank" rel="noopener noreferrer"
                  className="bg-white rounded-[18px] p-[15px_14px] shadow-[0_2px_14px_rgba(15,45,107,0.08)] flex flex-col gap-3 transition-[transform,box-shadow] duration-100 ease-out active:scale-[0.96] active:shadow-none">
                  <div className="flex items-start justify-between">
                    <div className="w-[58px] h-[58px] rounded-[18px] flex items-center justify-center" style={{ background: 'rgba(196,30,30,0.08)' }}>
                      <Phone className="w-[30px] h-[30px]" style={{ color: '#c41e1e' }} strokeWidth={1.5} />
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-[#64748b] mt-1" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="font-bold text-[13px] text-[#0f172a] leading-tight">Notfallnummern</p>
                    <p className="text-[11px] text-[#64748b] mt-0.5 leading-snug">Wichtige Rufnummern</p>
                  </div>
                </a>
              )}
              {(gemeinde as any)?.mitteilungsblatt_url && (
                <a href={(gemeinde as any).mitteilungsblatt_url} target="_blank" rel="noopener noreferrer"
                  className="bg-white rounded-[18px] p-[15px_14px] shadow-[0_2px_14px_rgba(15,45,107,0.08)] flex flex-col gap-3 transition-[transform,box-shadow] duration-100 ease-out active:scale-[0.96] active:shadow-none">
                  <div className="flex items-start justify-between">
                    <div className="w-[58px] h-[58px] rounded-[18px] flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.08)' }}>
                      <BookOpen className="w-[30px] h-[30px]" style={{ color: '#7c3aed' }} strokeWidth={1.5} />
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-[#64748b] mt-1" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="font-bold text-[13px] text-[#0f172a] leading-tight">Mitteilungsblatt</p>
                    <p className="text-[11px] text-[#64748b] mt-0.5 leading-snug">Amtliche Bekanntmachungen</p>
                  </div>
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
