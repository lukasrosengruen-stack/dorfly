/**
 * Hält angemeldete Nutzer in ihrer eigenen Gemeinde.
 *
 * Das Auth-Cookie gilt in Produktion für `.dorfly.de`, also für alle
 * Gemeinde-Subdomains zugleich. Öffnet jemand mit gültiger Session eine fremde
 * Subdomain (neuer Tab, geteilter Link), kamen Design und Features aus der
 * Subdomain, Feed/Vereine/Lokale Angebote aber aus profile.gemeinde_id — die
 * Inhalte zweier Gemeinden vermischten sich. /login und /start leiten bereits
 * auf die eigene Subdomain um, direkte Aufrufe von App-Routen bisher nicht.
 */

// Wie in gemeindeSpeicher.ts: der Slug landet im Host einer Weiterleitung.
const SLUG_MUSTER = /^[a-z0-9][a-z0-9-]{0,62}$/

export function zielFuerFremdeGemeinde({
  host,
  hostSlug,
  proto,
  profilSlug,
  role,
}: {
  host: string
  hostSlug: string | null
  proto: string
  profilSlug: string | null | undefined
  role: string | null | undefined
}): string | null {
  // Super-Admins betreuen alle Gemeinden und dürfen jede ansehen.
  if (role === 'super_admin') return null
  if (!hostSlug || !profilSlug || profilSlug === hostSlug) return null
  if (!SLUG_MUSTER.test(profilSlug)) return null

  // Nur umleiten, wenn der Slug wirklich aus der Subdomain stammt. Auf reinem
  // localhost kommt er aus NEXT_PUBLIC_DEFAULT_GEMEINDE_SLUG — dort gibt es
  // keinen anderen Host, und die Umleitung liefe im Kreis.
  if (!host.startsWith(`${hostSlug}.`)) return null

  return `${proto}://${profilSlug}.${host.slice(hostSlug.length + 1)}/home`
}
