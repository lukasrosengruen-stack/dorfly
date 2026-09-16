import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { navigationErfassen, hatInAppHistory, verlaufZuruecksetzen } from './navigationVerlauf'

/**
 * Minimaler History-Stack. Bildet genau das ab, worauf die Tiefenlogik sich
 * verlaesst: pushState legt einen neuen Eintrag an, back springt zum
 * vorherigen zurueck, und jeder Eintrag behaelt seinen eigenen State.
 */
function fakeHistory() {
  const eintraege: Record<string, unknown>[] = [{}]
  let index = 0
  return {
    get state() { return eintraege[index] },
    get length() { return eintraege.length },
    replaceState(s: Record<string, unknown>) { eintraege[index] = s },
    pushState(s: Record<string, unknown>) {
      eintraege.length = index + 1
      eintraege.push(s ?? {})
      index = eintraege.length - 1
    },
    back() { index = Math.max(0, index - 1) },
    forward() { index = Math.min(eintraege.length - 1, index + 1) },
  }
}

let history: ReturnType<typeof fakeHistory>

beforeEach(() => {
  history = fakeHistory()
  ;(globalThis as { window?: unknown }).window = { history }
  verlaufZuruecksetzen()
})

afterEach(() => {
  delete (globalThis as { window?: unknown }).window
})

describe('navigationVerlauf', () => {
  it('stempelt den Einstiegspunkt mit Tiefe 0 und meldet keine In-App-History', () => {
    navigationErfassen()

    expect(history.state).toEqual({ __dorflyTiefe: 0 })
    expect(hatInAppHistory()).toBe(false)
  })

  it('erkennt nach einer Navigation eine In-App-History', () => {
    navigationErfassen()

    history.pushState({})
    navigationErfassen()

    expect(hatInAppHistory()).toBe(true)
  })

  it('faellt beim Zurueckgehen wieder auf den Einstiegspunkt zurueck', () => {
    navigationErfassen()
    history.pushState({})
    navigationErfassen()

    history.back()
    navigationErfassen()

    // Genau der Fall, in dem window.history.length danebenlag: die Laenge
    // bleibt bei 2, obwohl es nichts mehr zum Zurueckgehen gibt.
    expect(history.length).toBe(2)
    expect(hatInAppHistory()).toBe(false)
  })

  it('zaehlt ueber mehrere Ebenen korrekt hoch und wieder herunter', () => {
    navigationErfassen()
    history.pushState({}); navigationErfassen()
    history.pushState({}); navigationErfassen()
    expect(hatInAppHistory()).toBe(true)

    history.back(); navigationErfassen()
    expect(hatInAppHistory()).toBe(true)

    history.back(); navigationErfassen()
    expect(hatInAppHistory()).toBe(false)
  })

  it('erkennt nach Zurueck und erneutem Vorwaerts wieder eine In-App-History', () => {
    navigationErfassen()
    history.pushState({}); navigationErfassen()
    history.back(); navigationErfassen()

    history.forward(); navigationErfassen()

    expect(hatInAppHistory()).toBe(true)
  })

  it('laesst fremde Felder im History-State unangetastet', () => {
    // Next.js legt eigene Routing-Daten im History-State ab; die duerfen beim
    // Stempeln nicht verloren gehen.
    history.replaceState({ __NA: true, key: 'abc' })
    navigationErfassen()

    expect(history.state).toEqual({ __NA: true, key: 'abc', __dorflyTiefe: 0 })
  })

  it('meldet ohne window keine In-App-History', () => {
    delete (globalThis as { window?: unknown }).window

    expect(() => navigationErfassen()).not.toThrow()
    expect(hatInAppHistory()).toBe(false)
  })
})
