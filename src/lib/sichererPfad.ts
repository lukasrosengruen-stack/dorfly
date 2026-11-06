/**
 * Prüft einen `next`-Parameter, bevor daraus eine Weiterleitung wird.
 *
 * /auth/callback baute das Ziel mit `new URL(next, origin)`. Bei einem absoluten
 * `next` gewinnt die absolute Adresse, und der Nutzer landete samt frisch
 * gesetzter Session-Cookies auf einer fremden Domain. Die Login-Seite prüfte
 * schon auf interne Pfade, der Callback nicht.
 *
 * Zugelassen ist nur ein Pfad mit genau einem führenden Schrägstrich. Erst
 * dekodieren, dann prüfen: `%2F%2Fevil.example` ist sonst unauffällig und wird
 * vom Browser trotzdem als protokollrelative Adresse gelesen. `/\` schließen
 * wir mit aus, weil mehrere Browser den Backslash wie einen Schrägstrich
 * behandeln.
 */
export function sichererPfad(roh: string | null | undefined): string | null {
  if (!roh) return null

  let pfad: string
  try {
    pfad = decodeURIComponent(roh)
  } catch {
    // Kaputtes Prozent-Encoding: nicht verwenden.
    return null
  }

  if (!pfad.startsWith('/')) return null
  if (pfad.startsWith('//') || pfad.startsWith('/\\')) return null

  return pfad
}
