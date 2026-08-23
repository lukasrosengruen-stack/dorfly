/**
 * Suche im Verwaltungs-Dashboard.
 */

export const SUCH_TYPEN = ['beitraege', 'maengel', 'fragen', 'warnmeldungen'] as const
export type SuchTyp = (typeof SUCH_TYPEN)[number]

/**
 * Maskiert die ilike-Platzhalter % und _, den Backslash selbst sowie das
 * Sternchen. PostgREST behandelt * in like/ilike-Filtern dokumentiert als
 * Alias fuer %, deshalb muss es genauso maskiert werden wie die anderen
 * Platzhalter. Ohne das liefert die Suche nach "50%" jeden Titel, der mit
 * "50" beginnt.
 *
 * Der Backslash muss zuerst ersetzt werden, sonst maskiert der Aufruf die
 * eigenen frisch eingefuegten Backslashes ein zweites Mal.
 *
 * Bewusster Kompromiss: PostgREST wandelt * serverseitig in % um, aus \*
 * wird also \% — das matcht ein woertliches Prozentzeichen, nicht ein
 * Sternchen. Ein Titel wie "Achtung *wichtig*" ist ueber die Suche nach "*"
 * daher nicht auffindbar. Im Verwaltungskontext ist das akzeptabel: zu
 * breite Treffer ohne Maskierung waeren schlimmer als ein nicht suchbares
 * Sonderzeichen.
 */
export function escapeIlike(eingabe: string): string {
  return eingabe
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
}
