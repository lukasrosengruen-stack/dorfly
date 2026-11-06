import { describe, expect, it } from 'vitest'
import { entferneOptimistisch } from './optimistischeListe'

interface Eintrag { id: string }

/** Verhaelt sich wie useState: Updater-Funktionen laufen gegen den aktuellen Stand. */
function zustand(start: Eintrag[]) {
  let liste = start
  return {
    get liste() { return liste },
    get ids() { return liste.map(e => e.id) },
    setListe(update: (prev: Eintrag[]) => Eintrag[]) { liste = update(liste) },
  }
}

const abc = () => [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

describe('entferneOptimistisch', () => {
  it('nimmt den Eintrag sofort aus der Liste, noch bevor der Server antwortet', () => {
    const z = zustand(abc())

    void entferneOptimistisch({ liste: z.liste, id: 'b', setListe: u => z.setListe(u), senden: () => new Promise(() => {}) })

    expect(z.ids).toEqual(['a', 'c'])
  })

  it('meldet Erfolg und laesst den Eintrag weg, wenn der Server zustimmt', async () => {
    const z = zustand(abc())

    const ok = await entferneOptimistisch({ liste: z.liste, id: 'b', setListe: u => z.setListe(u), senden: async () => {} })

    expect(ok).toBe(true)
    expect(z.ids).toEqual(['a', 'c'])
  })

  it('stellt den Eintrag bei einem Fehler an seiner alten Position wieder her', async () => {
    const z = zustand(abc())

    const ok = await entferneOptimistisch({
      liste: z.liste,
      id: 'b',
      setListe: u => z.setListe(u),
      senden: async () => { throw new Error('Serverfehler') },
    })

    expect(ok).toBe(false)
    expect(z.ids).toEqual(['a', 'b', 'c'])
  })

  it('haengt den Eintrag ans Ende, wenn die Liste inzwischen kuerzer ist', async () => {
    const z = zustand(abc())
    let scheitern: (grund: Error) => void = () => {}

    const laufend = entferneOptimistisch({
      liste: z.liste,
      id: 'c',
      setListe: u => z.setListe(u),
      senden: () => new Promise((_, reject) => { scheitern = reject }),
    })
    z.setListe(prev => prev.filter(e => e.id !== 'a'))
    scheitern(new Error('Serverfehler'))
    await laufend

    expect(z.ids).toEqual(['b', 'c'])
  })

  it('sendet nichts fuer einen Eintrag, den es nicht mehr gibt', async () => {
    const z = zustand(abc())
    let gesendet = false

    const ok = await entferneOptimistisch({
      liste: z.liste,
      id: 'x',
      setListe: u => z.setListe(u),
      senden: async () => { gesendet = true },
    })

    expect(ok).toBe(false)
    expect(gesendet).toBe(false)
    expect(z.ids).toEqual(['a', 'b', 'c'])
  })
})
