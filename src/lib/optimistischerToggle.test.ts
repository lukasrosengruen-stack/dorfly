import { describe, expect, it, vi } from 'vitest'
import { erstelleOptimistischenAbgleich, erstelleOptimistischenToggle } from './optimistischerToggle'

/** Sendefunktion, deren Antworten der Test einzeln ausloest. */
function steuerbaresSenden() {
  const offen: { ziel: boolean; antworten: (ok: boolean) => void }[] = []
  const senden = vi.fn((ziel: boolean) =>
    new Promise<void>((resolve, reject) => {
      offen.push({
        ziel,
        antworten: ok => (ok ? resolve() : reject(new Error('Serverfehler'))),
      })
    }),
  )
  return { senden, offen }
}

/** Laesst die laufende Promise-Kette weiterlaufen. */
const warteAufMikrotasks = () => new Promise(resolve => setTimeout(resolve, 0))

function aufbau(start = false) {
  const { senden, offen } = steuerbaresSenden()
  const onAenderung = vi.fn()
  const onBestaetigt = vi.fn()
  const onFehler = vi.fn()
  const toggle = erstelleOptimistischenToggle({ start, senden, onAenderung, onBestaetigt, onFehler })
  return { toggle, senden, offen, onAenderung, onBestaetigt, onFehler }
}

describe('erstelleOptimistischenAbgleich', () => {
  function abgleichMitStatus() {
    const offen: { antworten: (ok: boolean) => void }[] = []
    const senden = vi.fn<(ziel: string) => Promise<void>>(() =>
      new Promise((resolve, reject) => {
        offen.push({ antworten: ok => (ok ? resolve() : reject(new Error('Serverfehler'))) })
      }),
    )
    const onAenderung = vi.fn()
    const onFehler = vi.fn()
    const abgleich = erstelleOptimistischenAbgleich({ start: 'offen', senden, onAenderung, onFehler })
    return { abgleich, senden, offen, onAenderung, onFehler }
  }

  it('zeigt den neuen Wert sofort und kennt ihn als aktuellen Stand', () => {
    const { abgleich, onAenderung } = abgleichMitStatus()

    abgleich.setzen('erledigt')

    expect(onAenderung).toHaveBeenCalledWith('erledigt')
    expect(abgleich.aktuell()).toBe('erledigt')
  })

  it('ueberspringt Zwischenwerte, die waehrend einer laufenden Anfrage gesetzt werden', async () => {
    const { abgleich, senden, offen } = abgleichMitStatus()

    abgleich.setzen('in_bearbeitung')
    abgleich.setzen('offen')
    abgleich.setzen('erledigt')
    offen[0].antworten(true)
    await warteAufMikrotasks()
    offen[1].antworten(true)
    await warteAufMikrotasks()

    expect(senden.mock.calls.map(([ziel]) => ziel)).toEqual(['in_bearbeitung', 'erledigt'])
  })

  it('tut nichts, wenn der Wert schon gewuenscht ist', () => {
    const { abgleich, senden, onAenderung } = abgleichMitStatus()

    abgleich.setzen('offen')

    expect(senden).not.toHaveBeenCalled()
    expect(onAenderung).not.toHaveBeenCalled()
  })

  it('kennt nach einem Fehler wieder den bestaetigten Stand', async () => {
    const { abgleich, offen, onAenderung, onFehler } = abgleichMitStatus()

    abgleich.setzen('erledigt')
    offen[0].antworten(false)
    await warteAufMikrotasks()

    expect(abgleich.aktuell()).toBe('offen')
    expect(onAenderung).toHaveBeenLastCalledWith('offen')
    expect(onFehler).toHaveBeenCalledOnce()
  })
})

describe('erstelleOptimistischenToggle', () => {
  it('meldet den neuen Zustand sofort, noch bevor der Server antwortet', () => {
    const { toggle, onAenderung, onBestaetigt } = aufbau(false)

    toggle()

    expect(onAenderung).toHaveBeenCalledWith(true)
    expect(onBestaetigt).not.toHaveBeenCalled()
  })

  it('meldet die Bestaetigung erst nach der Serverantwort', async () => {
    const { toggle, offen, onBestaetigt, onFehler } = aufbau(false)

    toggle()
    offen[0].antworten(true)
    await warteAufMikrotasks()

    expect(onBestaetigt).toHaveBeenCalledExactlyOnceWith(true)
    expect(onFehler).not.toHaveBeenCalled()
  })

  it('springt bei einem Serverfehler auf den alten Zustand zurueck', async () => {
    const { toggle, offen, onAenderung, onBestaetigt, onFehler } = aufbau(false)

    toggle()
    offen[0].antworten(false)
    await warteAufMikrotasks()

    expect(onAenderung).toHaveBeenLastCalledWith(false)
    expect(onFehler).toHaveBeenCalledOnce()
    expect(onBestaetigt).not.toHaveBeenCalled()
  })

  it('schickt bei schnellem Doppeltippen die Anfragen nacheinander statt parallel', async () => {
    const { toggle, senden, offen, onAenderung, onBestaetigt } = aufbau(false)

    toggle()
    toggle()

    expect(onAenderung).toHaveBeenLastCalledWith(false)
    expect(senden).toHaveBeenCalledOnce()

    offen[0].antworten(true)
    await warteAufMikrotasks()

    expect(senden).toHaveBeenCalledTimes(2)
    expect(senden).toHaveBeenLastCalledWith(false)

    offen[1].antworten(true)
    await warteAufMikrotasks()

    expect(onBestaetigt).toHaveBeenCalledExactlyOnceWith(false)
  })

  it('fasst viele Tipper waehrend einer laufenden Anfrage zum letzten Wunsch zusammen', async () => {
    const { toggle, senden, offen } = aufbau(false)

    toggle()
    toggle()
    toggle()
    toggle()

    offen[0].antworten(true)
    await warteAufMikrotasks()
    offen[1].antworten(true)
    await warteAufMikrotasks()

    expect(senden.mock.calls.map(([ziel]) => ziel)).toEqual([true, false])
  })

  it('sendet nichts weiter, wenn der Wunsch dem bestaetigten Stand entspricht', async () => {
    const { toggle, senden, offen, onBestaetigt } = aufbau(false)

    toggle()
    toggle()
    toggle()

    offen[0].antworten(true)
    await warteAufMikrotasks()

    expect(senden).toHaveBeenCalledOnce()
    expect(onBestaetigt).toHaveBeenCalledExactlyOnceWith(true)
  })

  it('springt auf den letzten bestaetigten Stand zurueck, wenn die zweite Anfrage scheitert', async () => {
    const { toggle, offen, onAenderung, onFehler } = aufbau(false)

    toggle()
    toggle()
    offen[0].antworten(true)
    await warteAufMikrotasks()
    offen[1].antworten(false)
    await warteAufMikrotasks()

    expect(onAenderung).toHaveBeenLastCalledWith(true)
    expect(onFehler).toHaveBeenCalledOnce()
  })

  it('bleibt nach einem Fehler benutzbar', async () => {
    const { toggle, senden, offen, onBestaetigt } = aufbau(false)

    toggle()
    offen[0].antworten(false)
    await warteAufMikrotasks()

    toggle()
    expect(senden).toHaveBeenCalledTimes(2)
    expect(senden).toHaveBeenLastCalledWith(true)

    offen[1].antworten(true)
    await warteAufMikrotasks()

    expect(onBestaetigt).toHaveBeenCalledExactlyOnceWith(true)
  })
})
