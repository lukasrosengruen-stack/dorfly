'use client'

/**
 * Android-Hardware-Zurück (und Gesten-Zurück auf Android 13+).
 *
 * Ohne eigenen Listener übernimmt Capacitor: WebView-History zurück, und wenn
 * es keine gibt, wird die Activity beendet. Nach einer Push-Öffnung oder einem
 * Deep Link steht der Nutzer aber direkt auf einer Unterseite — die App würde
 * sich dort beim ersten Zurück schließen.
 *
 * Deshalb trifft dieser Listener dieselbe Entscheidung wie der sichtbare
 * Zurück-Button (useAppBack): zurück, solange es In-App-History gibt; sonst auf
 * die Übersicht hinter dem Mitte-Button; und erst auf der Übersicht selbst darf
 * sich die App beenden — das ist die Android-Konvention.
 *
 * iOS bleibt unberührt: dort feuert 'backButton' nicht, und weil wir die
 * History nicht manipulieren, funktioniert die Wischgeste vom linken Rand
 * unverändert.
 *
 * Gehört ins Root-Layout, nicht in AppInit: der Ausweg muss auch für Gäste und
 * im Admin-Bereich funktionieren.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Capacitor } from '@capacitor/core'
import { hatInAppHistory } from '@/lib/navigationVerlauf'

export default function HardwareBackHandler() {
  const router = useRouter()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let abgebrochen = false
    let entfernen: (() => void) | undefined

    const registrieren = async () => {
      try {
        const { App } = await import('@capacitor/app')
        const handle = await App.addListener('backButton', () => {
          if (hatInAppHistory()) {
            router.back()
          } else if (window.location.pathname !== '/home') {
            router.push('/home')
          } else {
            App.exitApp()
          }
        })
        if (abgebrochen) handle.remove()
        else entfernen = () => { handle.remove() }
      } catch {
        // Plugin nativ noch nicht synchronisiert (npx cap sync) oder Plattform
        // ohne Hardware-Zurück: dann bleibt Capacitors Standardverhalten.
      }
    }

    registrieren()

    return () => {
      abgebrochen = true
      entfernen?.()
    }
  }, [router])

  return null
}
