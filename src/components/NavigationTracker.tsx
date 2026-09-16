'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { navigationErfassen } from '@/lib/navigationVerlauf'

/**
 * Schreibt die Navigationstiefe in den jeweiligen History-Eintrag.
 * Rendert nichts; gehoert einmal pro Layout in den Baum.
 */
export default function NavigationTracker() {
  const pathname = usePathname()

  useEffect(() => {
    navigationErfassen()
  }, [pathname])

  return null
}
