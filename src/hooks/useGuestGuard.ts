'use client'

import { useIsGuest } from '@/lib/guestContext'
import { useLoginWallStore } from '@/stores/loginWall'

/**
 * Guard fuer account-basierte Interaktionen.
 * `requireLogin()` gibt true zurueck (= Aktion blockiert), wenn der Nutzer Gast ist,
 * und oeffnet dann die Login-Wall. Fuer eingeloggte Nutzer false (= Aktion laeuft).
 *
 * Nutzung in einem Handler:
 *   const { requireLogin } = useGuestGuard()
 *   if (requireLogin()) return
 */
export function useGuestGuard() {
  const isGuest = useIsGuest()
  const open = useLoginWallStore((s) => s.open)

  function requireLogin(): boolean {
    if (isGuest) {
      open()
      return true
    }
    return false
  }

  return { isGuest, requireLogin }
}
