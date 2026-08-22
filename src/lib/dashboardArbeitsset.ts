/**
 * Fuehrt mehrere Ergebnismengen zu einer Liste zusammen.
 *
 * Das Dashboard laedt je Liste ein begrenztes Arbeitsset (die neuesten N)
 * und ergaenzt es um Zeilen, die unabhaengig vom Alter sichtbar bleiben
 * muessen — offene Maengel, unbeantwortete Fragen, aktive Warnungen,
 * kommende Veranstaltungen. Diese Mengen ueberlappen sich, deshalb wird
 * ueber die id entdoppelt.
 *
 * Die erste Fundstelle einer id gewinnt.
 *
 * Die Sortierung vergleicht `created_at` als String (`localeCompare`), das ist
 * nur korrekt, wenn alle Zeitstempel denselben Zeitzonen-Offset tragen — bei
 * Supabase-`timestamptz`-Spalten durchgaengig `+00:00`/`Z`. Bei gemischten
 * Offsets waere ein echter Datumsvergleich noetig.
 */
export function mergeArbeitsset<T extends { id: string }>(
  gruppen: T[][],
  datumVon: (eintrag: T) => string | null,
): T[] {
  const gesehen = new Set<string>()
  const zusammen: T[] = []

  for (const gruppe of gruppen) {
    for (const eintrag of gruppe) {
      if (gesehen.has(eintrag.id)) continue
      gesehen.add(eintrag.id)
      zusammen.push(eintrag)
    }
  }

  // Zeilen ohne Datum ans Ende, sonst neueste zuerst.
  return zusammen.sort((a, b) => {
    const da = datumVon(a)
    const db = datumVon(b)
    if (da === null && db === null) return 0
    if (da === null) return 1
    if (db === null) return -1
    return db.localeCompare(da)
  })
}
