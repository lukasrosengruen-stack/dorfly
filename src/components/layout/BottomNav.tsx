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
  { href: '/umfragen',       label: 'Umfragen',   icon: BarChart2 },
  { href: '/buergermeister', label: 'Frag den BM', icon: MessageCircleQuestion },
]

export default function BottomNav({ role: _role }: { role?: string }) {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-100 z-50">
      <div className="flex max-w-lg mx-auto items-end">
        {leftItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href}
              className={clsx(
                'flex-1 flex flex-col items-center gap-0.5 py-2 px-1 text-[10px] font-semibold tracking-wide transition-colors relative',
                active ? 'text-primary-500' : 'text-gray-400 hover:text-gray-600'
              )}>
              {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary-500 rounded-full" />}
              <Icon className={clsx('w-5 h-5', active && 'stroke-[2.5]')} />
              <span className="uppercase leading-none mt-0.5">{label}</span>
            </Link>
          )
        })}

        {/* Center Home Button */}
        <Link href="/home"
          className="flex flex-col items-center justify-center pb-2 px-3 -mt-4 relative">
          <div className={clsx(
            'w-14 h-14 rounded-full flex items-center justify-center shadow-lg border-4 border-white transition-colors',
            pathname === '/home' ? 'bg-primary-600' : 'bg-primary-500'
          )}>
            <Grid2x2 className="w-6 h-6 text-white" />
          </div>
        </Link>

        {rightItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href}
              className={clsx(
                'flex-1 flex flex-col items-center gap-0.5 py-2 px-1 text-[10px] font-semibold tracking-wide transition-colors relative',
                active ? 'text-primary-500' : 'text-gray-400 hover:text-gray-600'
              )}>
              {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary-500 rounded-full" />}
              <Icon className={clsx('w-5 h-5', active && 'stroke-[2.5]')} />
              <span className="uppercase leading-none mt-0.5">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
