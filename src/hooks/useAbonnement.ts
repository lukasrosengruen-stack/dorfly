'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { erstelleOptimistischenToggle } from '@/lib/optimistischerToggle'
import { useGuestGuard } from '@/hooks/useGuestGuard'

const ENDPUNKT = {
  verein:  { url: '/api/verein/abonnieren',  idFeld: 'vereinId' },
  gewerbe: { url: '/api/gewerbe/abonnieren', idFeld: 'gewerbeId' },
}

interface UseAbonnementOptionen {
  art: keyof typeof ENDPUNKT
  id: string
  name: string
  istAbonniert: boolean
}

/**
 * Abo-Zustand fuer Vereine, Organisationen und Betriebe.
 * `abonniert` wechselt sofort beim Tippen und springt zurueck, wenn der Server ablehnt.
 */
export function useAbonnement({ art, id, name, istAbonniert }: UseAbonnementOptionen) {
  const [abonniert, setAbonniert] = useState(istAbonniert)
  const { requireLogin } = useGuestGuard()

  const [toggle] = useState(() => {
    const { url, idFeld } = ENDPUNKT[art]
    return erstelleOptimistischenToggle({
      start: istAbonniert,
      senden: async ziel => {
        const res = await fetch(url, {
          method: ziel ? 'POST' : 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [idFeld]: id }),
        })
        if (!res.ok) throw new Error()
      },
      onAenderung: setAbonniert,
      onBestaetigt: zustand => toast.success(zustand ? `${name} abonniert` : 'Abonnement gekündigt'),
      onFehler: () => toast.error('Fehler beim Aktualisieren'),
    })
  })

  function toggleAbonnement() {
    if (requireLogin()) return
    toggle()
  }

  return { abonniert, toggleAbonnement }
}
