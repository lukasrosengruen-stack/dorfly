'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Newspaper, AlertTriangle, Grid2x2, CalendarDays, MessageCircleQuestion } from 'lucide-react'
import { clsx } from 'clsx'
import type { GemeindeFeatures } from '@/lib/features'
import { useGuestGuard } from '@/hooks/useGuestGuard'

interface Props {
  role?: string
  features?: GemeindeFeatures
  buergermeisterShortLabel?: string
  isGuest?: boolean
}

// Ziele, die fuer Gaeste Login erfordern
const GUARDED_HREFS = new Set(['/maengel', '/buergermeister'])

export default function BottomNav({ role, features, buergermeisterShortLabel = 'Frag BM', isGuest = false }: Props) {
  void role
  const pathname = usePathname()
  const { requireLogin } = useGuestGuard()

  const leftItems = [
    { href: '/feed',    label: 'Newsfeed', icon: Newspaper },
    { href: '/maengel', label: 'Mängel',   icon: AlertTriangle },
  ]

  const rightItems = [
    { href: '/veranstaltungen', label: 'Veranstaltungen', icon: CalendarDays },
    { href: '/buergermeister', label: buergermeisterShortLabel, icon: MessageCircleQuestion },
  ]

  return (
    <nav className="pb-safe-nav fixed bottom-0 left-0 right-0 bg-white border-t border-[#e2e8f0] z-50">
      {/* items-stretch statt items-end: die Links füllen die volle Höhe aus und
          erreichen damit die 44px-Mindesttrefferfläche. Der Home-Indicator-
          Abstand kommt über pb-safe-nav am <nav>, nicht mehr über pb-3 hier —
          sonst lägen die unteren Tap-Zonen in der Systemgestenzone. */}
      <div className="flex max-w-lg mx-auto items-stretch min-h-[56px]">
        {leftItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href}
              onClick={(e) => {
                if (isGuest && GUARDED_HREFS.has(href)) {
                  e.preventDefault()
                  requireLogin()
                }
              }}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'group tap-transparent flex-1 flex flex-col items-center justify-center min-h-11 py-1 text-[9.5px] font-semibold transition-colors',
                active ? 'text-primary-500' : 'text-[#64748b]'
              )}>
              {/* Der Druckeffekt sitzt auf dem Inhalt, nicht auf dem Flex-Item:
                  ein Tab ist so schmal, dass eine Skalierung des ganzen Feldes
                  optisch nicht ankommt. Die Hintergrundfläche übernimmt die
                  Rolle, die auf home/page.tsx der wegspringende Schatten hat. */}
              <span className="flex flex-col items-center gap-0.5 rounded-xl px-3 py-1 transition-[transform,background-color] duration-100 ease-out group-active:scale-[0.88] group-active:bg-primary-100">
                <Icon className="w-[22px] h-[22px]" aria-hidden="true" strokeWidth={active ? 2.5 : 1.5} />
                <span>{label}</span>
              </span>
            </Link>
          )
        })}

        {/* Center Home Button */}
        <Link
          href="/home"
          aria-label="Startseite"
          aria-current={pathname === '/home' ? 'page' : undefined}
          className="group tap-transparent flex flex-col items-center justify-center px-3"
        >
          {/* Gleiches Muster wie die Kacheln auf home/page.tsx: eindrücken und
              Schatten wegnehmen. */}
          <div className={clsx(
            'w-[52px] h-[52px] rounded-2xl flex items-center justify-center -mt-4',
            'shadow-[0_4px_18px_rgba(15,45,107,0.4)]',
            'transition-[transform,box-shadow] duration-100 ease-out group-active:scale-[0.92] group-active:shadow-none',
            pathname === '/home' ? 'bg-primary-600' : 'bg-primary-500'
          )}>
            <Grid2x2 className="w-6 h-6 text-white" aria-hidden="true" strokeWidth={1.5} />
          </div>
        </Link>

        {rightItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href}
              onClick={(e) => {
                if (isGuest && GUARDED_HREFS.has(href)) {
                  e.preventDefault()
                  requireLogin()
                }
              }}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'group tap-transparent flex-1 flex flex-col items-center justify-center min-h-11 py-1 text-[9.5px] font-semibold transition-colors',
                active ? 'text-primary-500' : 'text-[#64748b]'
              )}>
              {/* Der Druckeffekt sitzt auf dem Inhalt, nicht auf dem Flex-Item:
                  ein Tab ist so schmal, dass eine Skalierung des ganzen Feldes
                  optisch nicht ankommt. Die Hintergrundfläche übernimmt die
                  Rolle, die auf home/page.tsx der wegspringende Schatten hat. */}
              <span className="flex flex-col items-center gap-0.5 rounded-xl px-3 py-1 transition-[transform,background-color] duration-100 ease-out group-active:scale-[0.88] group-active:bg-primary-100">
                <Icon className="w-[22px] h-[22px]" aria-hidden="true" strokeWidth={active ? 2.5 : 1.5} />
                <span>{label}</span>
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
