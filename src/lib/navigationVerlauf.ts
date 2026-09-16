/**
 * In-App-Navigationstiefe
 *
 * Die Frage "gibt es eine In-App-History, zu der ich zurueckgehen kann?" laesst
 * sich mit window.history.length nicht beantworten:
 *
 *   - In der WebView (Capacitor) und im PWA-Standalone-Fenster startet die
 *     Laenge bei 1, egal wie der Nutzer hereingekommen ist.
 *   - Nach einem Zurueck schrumpft history.length nicht. Wer zweimal zurueck
 *     drueckt, wuerde beim zweiten Mal aus der App herausfallen.
 *
 * Deshalb stempeln wir jeden History-Eintrag mit seiner eigenen Tiefe. Der
 * Stempel reist mit dem Eintrag: geht der Nutzer zurueck (Button, Wischgeste,
 * Hardware-Taste), liefert der wiederhergestellte Eintrag seine alte Tiefe
 * zurueck und der Zaehler stimmt wieder.
 *
 * Tiefe 0 = der Einstiegspunkt dieser Sitzung. Dort gibt es nichts mehr, wohin
 * zurueckgegangen werden koennte — der Aufrufer nimmt seinen Fallback.
 */

const STEMPEL = '__dorflyTiefe'

let tiefe = 0
let erstAufruf = true

/**
 * Nach jedem Routenwechsel aufrufen. Liest die Tiefe aus dem History-Eintrag
 * oder stempelt sie neu, wenn der Eintrag noch keine hat.
 */
export function navigationErfassen(): void {
  if (typeof window === 'undefined') return

  try {
    const state = (window.history.state ?? {}) as Record<string, unknown>
    const gestempelt = state[STEMPEL]

    if (typeof gestempelt === 'number') {
      // Rueckwaerts-, Vorwaerts- oder Reload-Navigation auf einen bekannten
      // Eintrag: die Tiefe kommt aus dem Eintrag, nicht aus dem Zaehler.
      tiefe = gestempelt
      return
    }

    // Neuer Eintrag. Beim allerersten Aufruf ist tiefe 0 und bleibt es —
    // der Einstiegspunkt bekommt die 0 gestempelt.
    const neu = erstAufruf ? 0 : tiefe + 1
    erstAufruf = false
    window.history.replaceState({ ...state, [STEMPEL]: neu }, '')
    tiefe = neu
  } catch {
    // replaceState kann in exotischen Umgebungen werfen. Dann bleibt der
    // Zaehler auf seinem letzten Stand; der Fallback greift im Zweifel.
  }
}

/** true, wenn ein Zurueck innerhalb der App landet und nicht aus ihr heraus. */
export function hatInAppHistory(): boolean {
  return tiefe > 0
}

/** Nur fuer Tests. */
export function verlaufZuruecksetzen(): void {
  tiefe = 0
  erstAufruf = true
}
