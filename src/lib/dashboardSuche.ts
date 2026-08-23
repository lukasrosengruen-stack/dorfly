/**
 * Suche im Verwaltungs-Dashboard.
 */

export const SUCH_TYPEN = ['beitraege', 'maengel', 'fragen', 'warnmeldungen'] as const
export type SuchTyp = (typeof SUCH_TYPEN)[number]

/**
 * Maskiert die ilike-Platzhalter % und _ sowie den Backslash selbst.
 * Ohne das liefert die Suche nach "50%" jeden Titel, der mit "50" beginnt.
 *
 * Der Backslash muss zuerst ersetzt werden, sonst maskiert der Aufruf die
 * eigenen frisch eingefuegten Backslashes ein zweites Mal.
 */
export function escapeIlike(eingabe: string): string {
  return eingabe
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
}
