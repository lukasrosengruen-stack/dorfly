/**
 * Entscheidet, ob eine Aenderung an einem Mangel den Melder erreichen soll.
 *
 * Bewusst eine reine Funktion ohne Supabase und ohne Netzwerk: die Frage
 * "lohnt sich eine Benachrichtigung?" laesst sich so ohne Infrastruktur
 * durchtesten. Der Versand selbst bleibt in der API-Route.
 */

import type { MaengelStatus } from '@/types/database'

export interface MangelZustand {
  /** Nullable in der Datenbank — Altbestand vor 042 hat keinen Status. */
  status: MaengelStatus | null
  nachricht: string | null
}

export interface MangelAenderung {
  statusGeaendert: boolean
  nachrichtGeaendert: boolean
}

/**
 * Gibt `null` zurueck, wenn nichts zu melden ist.
 *
 * Eine geloeschte oder leer gespeicherte Nachricht gilt nicht als Neuigkeit —
 * der Melder soll keine Mail bekommen, weil die Verwaltung einen Text entfernt
 * hat. Statuswechsel und neue Nachricht ergeben zusammen **eine** Meldung.
 */
export function mangelBenachrichtigung(
  vorher: MangelZustand,
  nachher: MangelZustand,
): MangelAenderung | null {
  const statusGeaendert = vorher.status !== nachher.status

  const neueNachricht = nachher.nachricht?.trim() ?? ''
  const alteNachricht = vorher.nachricht?.trim() ?? ''
  const nachrichtGeaendert = neueNachricht !== '' && neueNachricht !== alteNachricht

  if (!statusGeaendert && !nachrichtGeaendert) return null

  return { statusGeaendert, nachrichtGeaendert }
}

/**
 * Bestimmt, welcher Nachrichtentext nach einem Update in der Datenbank steht.
 *
 * Das Dashboard schickt beim reinen Statuswechsel kein `nachricht`-Feld mit.
 * Ohne diese Unterscheidung wuerde jeder Klick auf „Erledigt“ die Antwort an
 * den Buerger stillschweigend loeschen. `undefined` heisst also „nicht
 * angefasst“, ein leerer String heisst „ausdruecklich loeschen“.
 */
export function naechsteNachricht(
  bestehend: string | null,
  eingabe: string | undefined,
): string | null {
  if (eingabe === undefined) return bestehend
  return eingabe.trim() || null
}
