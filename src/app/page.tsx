import { redirect } from 'next/navigation'

/**
 * Root-Route (/)
 *
 * Leitet direkt zur Ehningen-App weiter.
 * Die Marketing-Seite ist unter /homepage erreichbar.
 *
 * Hintergrund: dorfly.app wird von Testnutzern genutzt.
 * Der Proxy setzt den Gemeinde-Slug auf "ehningen" wenn keine Subdomain gesetzt ist
 * (via NEXT_PUBLIC_DEFAULT_GEMEINDE_SLUG=ehningen).
 */
export default function RootPage() {
  redirect('/home')
}
