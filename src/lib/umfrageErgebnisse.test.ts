import { describe, it, expect } from 'vitest'
import { berechneErgebnisse } from './umfrageErgebnisse'

describe('berechneErgebnisse', () => {
  it('gibt bei leerer Fragenliste eine leere Liste zurueck', () => {
    expect(berechneErgebnisse([], [])).toEqual([])
  })

  it('zaehlt ja_nein aus und rechnet Prozente', () => {
    const [e] = berechneErgebnisse(
      [{ id: 'f1', frage_text: 'Magst du?', typ: 'ja_nein' }],
      [
        { frage_id: 'f1', option_id: null, antwort_text: 'ja', anzahl: 3 },
        { frage_id: 'f1', option_id: null, antwort_text: 'nein', anzahl: 1 },
      ],
    )
    expect(e.gesamt_antworten).toBe(4)
    expect(e.optionen).toEqual([
      { label: 'Ja', anzahl: 3, prozent: 75 },
      { label: 'Nein', anzahl: 1, prozent: 25 },
    ])
  })

  it('liefert bei ja_nein ohne Antworten 0 Prozent statt NaN', () => {
    const [e] = berechneErgebnisse(
      [{ id: 'f1', frage_text: 'Magst du?', typ: 'ja_nein' }],
      [],
    )
    expect(e.gesamt_antworten).toBe(0)
    expect(e.optionen.map(o => o.prozent)).toEqual([0, 0])
  })

  it('bildet bei bewertung den gewichteten Durchschnitt und alle fuenf Stufen ab', () => {
    const [e] = berechneErgebnisse(
      [{ id: 'f1', frage_text: 'Wie gut?', typ: 'bewertung' }],
      [
        { frage_id: 'f1', option_id: null, antwort_text: '5', anzahl: 2 },
        { frage_id: 'f1', option_id: null, antwort_text: '3', anzahl: 2 },
      ],
    )
    expect(e.gesamt_antworten).toBe(4)
    expect(e.durchschnitt).toBe(4)
    expect(e.optionen).toHaveLength(5)
    expect(e.optionen.map(o => o.anzahl)).toEqual([0, 0, 2, 0, 2])
    expect(e.optionen.map(o => o.prozent)).toEqual([0, 0, 50, 0, 50])
  })

  it('liefert bei bewertung ohne Antworten Durchschnitt 0', () => {
    const [e] = berechneErgebnisse(
      [{ id: 'f1', frage_text: 'Wie gut?', typ: 'bewertung' }],
      [],
    )
    expect(e.durchschnitt).toBe(0)
    expect(e.optionen.map(o => o.prozent)).toEqual([0, 0, 0, 0, 0])
  })

  it('sortiert Auswahloptionen nach reihenfolge und zeigt auch Optionen ohne Stimmen', () => {
    const [e] = berechneErgebnisse(
      [{
        id: 'f1', frage_text: 'Welche?', typ: 'einzelauswahl',
        umfrage_optionen: [
          { id: 'o2', option_text: 'B', reihenfolge: 2 },
          { id: 'o1', option_text: 'A', reihenfolge: 1 },
        ],
      }],
      [{ frage_id: 'f1', option_id: 'o1', antwort_text: null, anzahl: 3 }],
    )
    expect(e.gesamt_antworten).toBe(3)
    expect(e.optionen).toEqual([
      { label: 'A', anzahl: 3, prozent: 100, option_id: 'o1' },
      { label: 'B', anzahl: 0, prozent: 0, option_id: 'o2' },
    ])
  })

  it('veraendert die uebergebene Optionsliste nicht', () => {
    const optionen = [
      { id: 'o2', option_text: 'B', reihenfolge: 2 },
      { id: 'o1', option_text: 'A', reihenfolge: 1 },
    ]
    berechneErgebnisse(
      [{ id: 'f1', frage_text: 'Welche?', typ: 'einzelauswahl', umfrage_optionen: optionen }],
      [],
    )
    expect(optionen.map(o => o.id)).toEqual(['o2', 'o1'])
  })

  it('ordnet Antworten der richtigen Frage zu', () => {
    const ergebnisse = berechneErgebnisse(
      [
        { id: 'f1', frage_text: 'Erste', typ: 'ja_nein' },
        { id: 'f2', frage_text: 'Zweite', typ: 'ja_nein' },
      ],
      [{ frage_id: 'f2', option_id: null, antwort_text: 'ja', anzahl: 7 }],
    )
    expect(ergebnisse[0].gesamt_antworten).toBe(0)
    expect(ergebnisse[1].gesamt_antworten).toBe(7)
  })
})
