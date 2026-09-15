import { describe, it, expect } from 'vitest'
import { mangelBenachrichtigung, naechsteNachricht } from './mangelBenachrichtigung'

describe('mangelBenachrichtigung', () => {
  it('meldet nichts, wenn sich weder Status noch Nachricht aendern', () => {
    expect(
      mangelBenachrichtigung(
        { status: 'offen', nachricht: 'Wir schauen uns das an.' },
        { status: 'offen', nachricht: 'Wir schauen uns das an.' },
      ),
    ).toBeNull()
  })

  it('meldet einen Statuswechsel', () => {
    expect(
      mangelBenachrichtigung(
        { status: 'offen', nachricht: null },
        { status: 'in_bearbeitung', nachricht: null },
      ),
    ).toEqual({ statusGeaendert: true, nachrichtGeaendert: false })
  })

  it('meldet eine neue Nachricht', () => {
    expect(
      mangelBenachrichtigung(
        { status: 'offen', nachricht: null },
        { status: 'offen', nachricht: 'Der Bauhof faehrt am Montag raus.' },
      ),
    ).toEqual({ statusGeaendert: false, nachrichtGeaendert: true })
  })

  it('fasst gleichzeitigen Statuswechsel und neue Nachricht zu einer Meldung zusammen', () => {
    expect(
      mangelBenachrichtigung(
        { status: 'offen', nachricht: null },
        { status: 'erledigt', nachricht: 'Schlagloch ist verfuellt.' },
      ),
    ).toEqual({ statusGeaendert: true, nachrichtGeaendert: true })
  })

  it('ignoriert eine unveraendert erneut gespeicherte Nachricht', () => {
    expect(
      mangelBenachrichtigung(
        { status: 'offen', nachricht: 'Gleicher Text' },
        { status: 'offen', nachricht: '  Gleicher Text  ' },
      ),
    ).toBeNull()
  })

  it('meldet nichts, wenn die Nachricht geloescht wird', () => {
    expect(
      mangelBenachrichtigung(
        { status: 'offen', nachricht: 'Alter Text' },
        { status: 'offen', nachricht: null },
      ),
    ).toBeNull()
  })

  it('wertet einen leeren Text wie eine geloeschte Nachricht', () => {
    expect(
      mangelBenachrichtigung(
        { status: 'offen', nachricht: 'Alter Text' },
        { status: 'offen', nachricht: '   ' },
      ),
    ).toBeNull()
  })

  it('wertet den Wechsel von status null auf einen Wert als Aenderung', () => {
    expect(
      mangelBenachrichtigung(
        { status: null, nachricht: null },
        { status: 'offen', nachricht: null },
      ),
    ).toEqual({ statusGeaendert: true, nachrichtGeaendert: false })
  })
})

describe('naechsteNachricht', () => {
  it('behaelt die bestehende Nachricht, wenn die Eingabe kein Feld enthaelt', () => {
    expect(naechsteNachricht('Bauhof faehrt Montag raus.', undefined)).toBe('Bauhof faehrt Montag raus.')
  })

  it('uebernimmt eine neue Nachricht', () => {
    expect(naechsteNachricht('Alter Text', 'Neuer Text')).toBe('Neuer Text')
  })

  it('loescht die Nachricht bei ausdruecklich leerer Eingabe', () => {
    expect(naechsteNachricht('Alter Text', '')).toBeNull()
  })

  it('wertet reinen Leerraum als Loeschen', () => {
    expect(naechsteNachricht('Alter Text', '   ')).toBeNull()
  })

  it('schneidet Leerraum am Rand ab', () => {
    expect(naechsteNachricht(null, '  Neuer Text  ')).toBe('Neuer Text')
  })
})
