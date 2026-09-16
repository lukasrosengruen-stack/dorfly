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
import { Logo } from '@/components/ui'
import { ZurueckButton } from '@/components/ui'

export default function LegalNav() {
  return (
    <nav className="pt-safe sticky top-0 z-50 border-b border-[#DDE6F0] bg-white/95 px-6 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-[800px] items-center gap-3">
        {/* Das "wohin zurück?" entscheidet jetzt useAppBack anhand der
            tatsächlichen Navigationstiefe — window.history.length war in der
            WebView und im PWA-Standalone-Fenster nicht aussagekräftig. */}
        <ZurueckButton fallback="/home" variant="dunkel" />

        <Link href="/" className="tap-transparent ml-auto" aria-label="Zur Startseite">
          <Logo />
        </Link>
      </div>
    </nav>
  )
}