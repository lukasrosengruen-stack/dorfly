'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Newspaper, AlertTriangle, Grid2x2, BarChart2, MessageCircleQuestion } from 'lucide-react'
import { clsx } from 'clsx'

const leftItems = [
  { href: '/feed',    label: 'Newsfeed', icon: Newspaper },
  { href: '/maengel', label: 'Mängel',   icon: AlertTriangle },
]

const rightItems = [
  { href: '/umfragen',       label: 'Umfragen',  icon: BarChart2 },
  { href: '/buergermeister', label: 'Frag BM',   icon: MessageCircleQuestion },
]

export default function BottomNav({ role: _role }: { role?: string }) {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e2e8f0] z-50">
      <div className="flex max-w-lg mx-auto items-end h-[68px] pb-3">
        {leftItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href}
              className={clsx(
                'flex-1 flex flex-col items-center gap-0.5 pt-2 text-[9.5px] font-semibold transition-colors',
                active ? 'text-primary-500' : 'text-[#64748b]'
              )}>
              <Icon className="w-[22px] h-[22px]" strokeWidth={active ? 2.5 : 1.5} />
              <span>{label}</span>
            </Link>
          )
        })}

        {/* Center Home Button – quadratisch mit Radius */}
        <Link href="/home" className="flex flex-col items-center justify-end pb-0 px-3">
          <div className={clsx(
            'w-[52px] h-[52px] rounded-2xl flex items-center justify-center -mt-4',
            'shadow-[0_4px_18px_rgba(15,45,107,0.4)]',
            pathname === '/home' ? 'bg-primary-600' : 'bg-primary-500'
          )}>
            <Grid2x2 className="w-6 h-6 text-white" strokeWidth={1.5} />
          </div>
        </Link>

        {rightItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href}
              className={clsx(
                'flex-1 flex flex-col items-center gap-0.5 pt-2 text-[9.5px] font-semibold transition-colors',
                active ? 'text-primary-500' : 'text-[#64748b]'
              )}>
              <Icon className="w-[22px] h-[22px]" strokeWidth={active ? 2.5 : 1.5} />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
