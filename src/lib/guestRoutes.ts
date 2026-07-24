// Nicht-account-basierte Routen, die Gäste (ohne Login) sehen dürfen.
// Genutzt von der Middleware, um den Session-Redirect für diese Pfade zu überspringen.
export const GUEST_ROUTE_PREFIXES = [
  '/home',
  '/feed',
  '/warnmeldungen',
  '/veranstaltungen',
  '/abfallkalender',
  '/vereine',
  '/lokale-angebote',
] as const

export function isGuestRoute(pathname: string): boolean {
  return GUEST_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/'),
  )
}
