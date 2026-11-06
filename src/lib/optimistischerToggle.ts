interface OptimistischerAbgleichOptionen<T> {
  start: T
  /** Uebertraegt den Zielwert an den Server. Ablehnung = fehlgeschlagen. */
  senden: (ziel: T) => Promise<void>
  /** Neuer Anzeigewert: sofort beim Setzen und beim Zuruecksetzen nach einem Fehler. */
  onAenderung: (wert: T) => void
  /** Der Server hat den zuletzt gewuenschten Wert gespeichert. */
  onBestaetigt?: (wert: T) => void
  onFehler: () => void
}

/**
 * Wert, der sofort angezeigt und im Hintergrund mit dem Server abgeglichen wird.
 *
 * Es laeuft immer nur eine Anfrage. Wird waehrenddessen erneut gesetzt, zaehlt am Ende nur
 * der letzte Wunsch; so kann eine spaeter eintreffende Antwort den Stand nicht verdrehen.
 * Werte werden per `===` verglichen, Objekte also ueber ihre Identitaet.
 */
export function erstelleOptimistischenAbgleich<T>({
  start,
  senden,
  onAenderung,
  onBestaetigt,
  onFehler,
}: OptimistischerAbgleichOptionen<T>) {
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
      onBestaetigt?.(bestaetigt)
    } catch {
      gewuenscht = bestaetigt
      onAenderung(bestaetigt)
      onFehler()
    } finally {
      laeuft = false
    }
  }

  return {
    aktuell: () => gewuenscht,
    setzen(ziel: T) {
      if (ziel === gewuenscht) return
      gewuenscht = ziel
      onAenderung(ziel)
      if (!laeuft) void abgleichen()
    },
  }
}

/** An/Aus-Schalter auf Basis von {@link erstelleOptimistischenAbgleich}. */
export function erstelleOptimistischenToggle(optionen: OptimistischerAbgleichOptionen<boolean>) {
  const abgleich = erstelleOptimistischenAbgleich(optionen)
  return () => abgleich.setzen(!abgleich.aktuell())
}
