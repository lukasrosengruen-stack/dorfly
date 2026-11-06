interface OptimistischerToggleOptionen {
  start: boolean
  /** Uebertraegt den Zielzustand an den Server. Ablehnung = fehlgeschlagen. */
  senden: (ziel: boolean) => Promise<void>
  /** Neuer Anzeigezustand: sofort beim Tippen und beim Zuruecksetzen nach einem Fehler. */
  onAenderung: (zustand: boolean) => void
  /** Der Server hat den zuletzt gewuenschten Zustand gespeichert. */
  onBestaetigt: (zustand: boolean) => void
  onFehler: () => void
}

/**
 * An/Aus-Schalter, der sofort reagiert und im Hintergrund mit dem Server abgleicht.
 *
 * Es laeuft immer nur eine Anfrage. Tippt jemand waehrenddessen erneut, zaehlt am Ende nur
 * der letzte Wunsch; so kann eine spaeter eintreffende Antwort den Stand nicht verdrehen.
 */
export function erstelleOptimistischenToggle({
  start,
  senden,
  onAenderung,
  onBestaetigt,
  onFehler,
}: OptimistischerToggleOptionen) {
  let gewuenscht = start
  let bestaetigt = start
  let laeuft = false

  async function abgleichen() {
    laeuft = true
    try {
      while (bestaetigt !== gewuenscht) {
        const ziel = gewuenscht
        await senden(ziel)
        bestaetigt = ziel
      }
      onBestaetigt(bestaetigt)
    } catch {
      gewuenscht = bestaetigt
      onAenderung(bestaetigt)
      onFehler()
    } finally {
      laeuft = false
    }
  }

  return function toggle() {
    gewuenscht = !gewuenscht
    onAenderung(gewuenscht)
    if (!laeuft) void abgleichen()
  }
}
