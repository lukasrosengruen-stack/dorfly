'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { hatInAppHistory } from '@/lib/navigationVerlauf'

/**
 * Zurueck-Navigation, die niemals aus der App herausfuehrt.
 *
 * Solange es eine In-App-History gibt, gewinnt router.back() — damit bleiben
 * Scrollposition und die iOS-Wischgeste erhalten. Bei Deep Link, Push-Oeffnung
 * oder PWA-Start direkt auf der Unterseite gibt es nichts zum Zurueckgehen;
 * dann wird die Uebersichtsseite gepusht.
 *
 * @param fallback Ziel ohne In-App-History. Standard: die Uebersicht hinter dem
 *                 Mitte-Button der Bottom-Navigation.
 */
export function useAppBack(fallback: string = '/home') {
  const router = useRouter()

  return useCallback(() => {
    if (hatInAppHistory()) router.back()
    else router.push(fallback)
  }, [router, fallback])
}
