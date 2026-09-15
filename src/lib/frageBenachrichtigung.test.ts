import { describe, it, expect } from 'vitest'
import { frageAntwortIstNeu, kuerzeFrage } from './frageBenachrichtigung'

describe('frageAntwortIstNeu', () => {
  it('meldet die erste Antwort auf eine offene Frage', () => {
    expect(frageAntwortIstNeu(null, 'Der Spielplatz wird im Mai saniert.')).toBe(true)
  })

  it('meldet eine inhaltlich geaenderte Antwort', () => {
    expect(frageAntwortIstNeu('Im Mai.', 'Doch erst im Juni.')).toBe(true)
  })

  it('meldet nichts, wenn dieselbe Antwort erneut gespeichert wird', () => {
    expect(frageAntwortIstNeu('Im Mai.', 'Im Mai.')).toBe(false)
  })

  it('ignoriert Leerraum am Rand', () => {
    expect(frageAntwortIstNeu('Im Mai.', '  Im Mai.  ')).toBe(false)
  })
})

describe('kuerzeFrage', () => {
  it('laesst kurze Fragen unveraendert', () => {
    expect(kuerzeFrage('Wann kommt der Spielplatz?', 40)).toBe('Wann kommt der Spielplatz?')
  })

  it('kuerzt lange Fragen und haengt ein Auslassungszeichen an', () => {
    expect(kuerzeFrage('Wann genau wird der Spielplatz am Dorfanger saniert?', 20))
      .toBe('Wann genau wird der…')
  })

  it('schneidet kein Wort mittendrin ab', () => {
    expect(kuerzeFrage('Wann genau wird saniert?', 12)).toBe('Wann genau…')
  })

  it('faellt auf harten Schnitt zurueck, wenn das erste Wort schon zu lang ist', () => {
    expect(kuerzeFrage('Donaudampfschifffahrtsgesellschaft?', 10)).toBe('Donaudamp…')
  })

  it('normalisiert Zeilenumbrueche zu Leerzeichen', () => {
    expect(kuerzeFrage('Wann\n\nkommt der Spielplatz?', 40)).toBe('Wann kommt der Spielplatz?')
  })
})
