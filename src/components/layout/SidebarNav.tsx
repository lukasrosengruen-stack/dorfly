'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Newspaper, AlertTriangle, MessageCircleQuestion, LayoutDashboard, User } from 'lucide-react'
import { clsx } from 'clsx'

const items = [
  { href: '/feed',           label: 'News',         icon: Newspaper },
  { href: '/maengel',        label: 'Mängel',        icon: AlertTriangle },
  { href: '/buergermeister', label: 'Bürgerfragen',  icon: MessageCircleQuestion },
  { href: '/dashboard',      label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/profil',         label: 'Profil',        icon: User },
]

export default function SidebarNav({ gemeindeName }: { gemeindeName?: string }) {
  const pathname = usePathname()

  return (
    <aside className="w-56 min-h-screen bg-white border-r border-gray-200 flex flex-col shrink-0">
      <div className="px-5 py-5 border-b border-gray-100">
        <p className="font-extrabold text-primary-500 text-xl tracking-tight">Dorfly</p>
        {gemeindeName && <p className="text-xs text-gray-400 mt-0.5 truncate">{gemeindeName}</p>}
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                active
                  ? 'bg-primary-50 text-primary-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Icon className={clsx('w-4 h-4 shrink-0', active && 'stroke-[2.5]')} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-gray-100">
        <p className="text-xs text-gray-400 px-3 py-2">Verwaltungsansicht</p>
      </div>
    </aside>
  )
}

