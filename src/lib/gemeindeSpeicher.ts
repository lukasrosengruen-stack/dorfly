/**
 * Merkt sich die zuletzt gewählte Gemeinde.
 *
 * WICHTIG — Geltungsbereich: localStorage ist origin-gebunden. `dorfly.de` und
 * `ehningen.dorfly.de` haben getrennte Speicher. Geschrieben und gelesen wird
 * deshalb ausschließlich auf der Apex-Domain, wo /start liegt und wo die native
 * App laut capacitor.config.ts jeden Kaltstart beginnt. Ein Schreibzugriff von
 * einer Gemeinde-Subdomain aus wäre für /start unsichtbar.
 *
 * Für angemeldete Nutzer ist das nur ein Fallback: dort ist das Profil
 * (gemeinde_id → slug) die verlässlichere Quelle, weil es serverseitig
 * gelesen wird und nicht veralten kann.
 */

const SCHLUESSEL = 'dorfly.gemeinde-slug'

// Slugs stammen aus der Datenbank und landen in einer URL — vor dem Zurücklesen
// trotzdem validieren, damit ein manipulierter localStorage-Eintrag keine
// fremde Host-Weiterleitung erzeugen kann.
const SLUG_MUSTER = /^[a-z0-9][a-z0-9-]{0,62}$/

export function speichereGemeinde(slug: string): void {
  if (typeof window === 'undefined' || !SLUG_MUSTER.test(slug)) return
  try {
    window.localStorage.setItem(SCHLUESSEL, slug)
  } catch {
    // Private Mode oder gesperrter Speicher — kein Grund, den Ablauf zu stoppen.
  }
}

export function leseGemeinde(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const slug = window.localStorage.getItem(SCHLUESSEL)
    return slug && SLUG_MUSTER.test(slug) ? slug : null
  } catch {
    return null
  }
}

export function vergissGemeinde(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(SCHLUESSEL)
  } catch {
    // s.o.
  }
}