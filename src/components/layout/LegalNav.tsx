'use client'

/**
 * LegalNav – gemeinsame Kopfleiste für /datenschutz, /impressum und
 * /nutzungsbedingungen.
 *
 * Diese Seiten liegen außerhalb der Route-Group (app) und haben deshalb weder
 * BottomNav noch PageHeader. Ohne eigenen Ausweg waren sie in der nativen App
 * eine Sackgasse (kein Swipe-Back in der WKWebView) — die App musste neu
 * gestartet werden.
 *
 * Die Seiten bleiben in PUBLIC_ROUTES und damit ohne Login erreichbar.
 * /home ist ebenfalls eine Gast-Route, der Fallback funktioniert also auch
 * für nicht angemeldete Nutzer.
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/ui'

export default function LegalNav() {
  const router = useRouter()

  function handleBack() {
    // Deeplink oder Kaltstart direkt auf dieser Seite: es gibt nichts, wohin
    // zurückgegangen werden könnte.
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push('/home')
    }
  }

  return (
    <nav className="pt-safe sticky top-0 z-50 border-b border-[#DDE6F0] bg-white/95 px-6 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-[800px] items-center gap-3">
        <button
          type="button"
          onClick={handleBack}
          className="tap-transparent -ml-2 flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-xl px-2 text-sm font-semibold text-[#0057A8] transition-transform duration-150 ease-out active:scale-[0.96]"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          Zurück
        </button>

        <Link href="/" className="tap-transparent ml-auto" aria-label="Zur Startseite">
          <Logo />
        </Link>
      </div>
    </nav>
  )
}