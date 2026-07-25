'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X, LogIn, UserPlus } from 'lucide-react'
import { useLoginWallStore } from '@/stores/loginWall'
import { useFocusTrap } from '@/hooks/useFocusTrap'

export default function LoginWall() {
  const isOpen = useLoginWallStore((s) => s.isOpen)
  const close = useLoginWallStore((s) => s.close)
  const pathname = usePathname()
  const trapRef = useFocusTrap(isOpen)

  if (!isOpen) return null

  const next = encodeURIComponent(pathname)

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[100] flex items-end sm:items-center justify-center p-4"
      onClick={close}
      onKeyDown={(e) => e.key === 'Escape' && close()}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="loginwall-title"
        className="bg-white w-full max-w-sm rounded-2xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="loginwall-title" className="font-bold text-gray-900 text-lg">
            Anmeldung erforderlich
          </h2>
          <button onClick={close} aria-label="Dialog schließen" className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <p className="text-sm text-gray-500 leading-relaxed">
          Melde dich an oder registriere dich, um mitzumachen – abstimmen, abonnieren, melden und mehr.
        </p>

        <div className="space-y-2 pt-1">
          <Link
            href={`/login?next=${next}`}
            className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
          >
            <LogIn className="w-5 h-5" aria-hidden="true" /> Anmelden
          </Link>
          <Link
            href={`/login?mode=register&next=${next}`}
            className="w-full border border-gray-300 text-gray-700 font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
          >
            <UserPlus className="w-5 h-5" aria-hidden="true" /> Registrieren
          </Link>
        </div>
      </div>
    </div>
  )
}
