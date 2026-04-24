'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Newspaper, AlertTriangle, ShoppingBag, BarChart2, MessageCircleQuestion, LayoutDashboard } from 'lucide-react'
import { clsx } from 'clsx'

const defaultItems = [
  { href: '/feed',           label: 'Newsfeed',    icon: Newspaper },
  { href: '/maengel',        label: 'Mängel',       icon: AlertTriangle },
  { href: '/marktplatz',     label: 'Marktplatz',   icon: ShoppingBag },
  { href: '/umfragen',       label: 'Umfragen',     icon: BarChart2 },
  { href: '/buergermeister', label: 'Frag den BM',  icon: MessageCircleQuestion },
]

const vereinItems = [
  { href: '/feed',      label: 'Newsfeed',   icon: Newspaper },
  { href: '/dashboard', label: 'Dashboard',  icon: LayoutDashboard },
]

export default function BottomNav({ role }: { role?: string }) {
  const pathname = usePathname()
  const items = role === 'verein' ? vereinItems : defaultItems

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-100 z-50 safe-area-inset-bottom">
      <div className="flex max-w-lg mx-auto">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex-1 flex flex-col items-center gap-0.5 py-2 px-1 text-[10px] font-semibold tracking-wide transition-colors relative',
                active ? 'text-primary-500' : 'text-gray-400 hover:text-gray-600'
              )}
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary-500 rounded-full" />
              )}
              <Icon className={clsx('w-5 h-5', active && 'stroke-[2.5]')} />
              <span className="uppercase leading-none mt-0.5">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
