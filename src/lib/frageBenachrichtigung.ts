/**
 * Hilfsfunktionen fuer die Benachrichtigung bei „Frag den Buergermeister“.
 *
 * Bewusst reine Funktionen ohne Supabase und ohne Netzwerk — der Versand
 * bleibt in der API-Route, die Entscheidung laesst sich so durchtesten.
 */

/**
 * Sagt, ob eine gespeicherte Antwort fuer den Fragesteller neu ist.
 *
 * Die Verwaltung kann eine Antwort nachtraeglich korrigieren; nur eine
 * inhaltliche Aenderung soll eine zweite Mail ausloesen, nicht ein erneutes
 * Speichern desselben Textes.
 */
export function frageAntwortIstNeu(vorher: string | null, nachher: string): boolean {
  return nachher.trim() !== (vorher?.trim() ?? '')
}

/**
 * Kuerzt eine Frage auf Betrefflaenge, ohne ein Wort mittendrin abzuschneiden.
 *
 * `max` schliesst das Auslassungszeichen ein, damit der Rueckgabewert nie
 * laenger als `max` wird.
 */
export function kuerzeFrage(frage: string, max: number): string {
  // Zeilenumbrueche zerschiessen sonst den Mailbetreff.
  const einzeilig = frage.replace(/\s+/g, ' ').trim()
  if (einzeilig.length <= max) return einzeilig

  const roh = einzeilig.slice(0, max - 1)
  // Faellt der Schnitt genau auf eine Wortgrenze, ist `roh` bereits sauber —
  // sonst wuerde das letzte vollstaendige Wort unnoetig wegfallen.
  if (einzeilig[max - 1] === ' ') return `${roh}…`

  const letzteLuecke = roh.lastIndexOf(' ')
  // Steht im erlaubten Bereich keine Wortgrenze, bleibt nur der harte Schnitt.
  const gekuerzt = letzteLuecke > 0 ? roh.slice(0, letzteLuecke) : roh
  return `${gekuerzt}…`
}
