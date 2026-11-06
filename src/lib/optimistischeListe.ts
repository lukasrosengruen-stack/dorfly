interface EntferneOptimistischOptionen<T> {
  liste: T[]
  id: string
  setListe: (update: (prev: T[]) => T[]) => void
  /** Loescht auf dem Server. Ablehnung = fehlgeschlagen. */
  senden: () => Promise<void>
}

/**
 * Nimmt einen Eintrag sofort aus der Liste und stellt ihn an seiner alten Position
 * wieder her, wenn der Server ablehnt. Gibt zurueck, ob das Entfernen geklappt hat.
 */
export async function entferneOptimistisch<T extends { id: string }>({
  liste,
  id,
  setListe,
  senden,
}: EntferneOptimistischOptionen<T>): Promise<boolean> {
  const index = liste.findIndex(e => e.id === id)
  if (index === -1) return false
  const eintrag = liste[index]

  setListe(prev => prev.filter(e => e.id !== id))
  try {
    await senden()
    return true
  } catch {
    setListe(prev => [...prev.slice(0, index), eintrag, ...prev.slice(index)])
    return false
  }
}
