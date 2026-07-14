import { describe, it, expect } from 'vitest'
import {
  SAMMLUNG_ART_OPTIONEN,
  SAMMLUNG_ART_CONFIG,
  SAMMLUNG_PRAEFERENZ_SCHLUESSEL,
  sammlungPraeferenzSchluessel,
  mapSammlungPostsZuTerminen,
  getTerminAnzeigeConfig,
} from './abfallkalenderSammlung'

describe('sammlungPraeferenzSchluessel', () => {
  it('baut den Präferenz-Schlüssel aus der Sammlungsart', () => {
    expect(sammlungPraeferenzSchluessel('altpapier')).toBe('sammlung_altpapier')
    expect(sammlungPraeferenzSchluessel('schrott')).toBe('sammlung_schrott')
  })
})

describe('SAMMLUNG_PRAEFERENZ_SCHLUESSEL', () => {
  it('enthält alle vier Sammlungsarten als Präferenz-Schlüssel', () => {
    expect(SAMMLUNG_PRAEFERENZ_SCHLUESSEL).toEqual([
      'sammlung_altpapier', 'sammlung_altkleider', 'sammlung_altglas', 'sammlung_schrott',
    ])
  })
})

describe('SAMMLUNG_ART_OPTIONEN / SAMMLUNG_ART_CONFIG', () => {
  it('enthält für jede Option einen passenden Konfig-Eintrag', () => {
    for (const option of SAMMLUNG_ART_OPTIONEN) {
      expect(SAMMLUNG_ART_CONFIG[option.value].label).toBe(option.label)
    }
  })
})

describe('mapSammlungPostsZuTerminen', () => {
  it('mappt einen veröffentlichten Sammlungs-Post auf einen Kalender-Termin und trennt Tag und Zeitpunkt', () => {
    const result = mapSammlungPostsZuTerminen([
      { id: 'p1', sammlung_art: 'altpapier', sammlung_datum: '2026-08-01T09:00:00+00:00', sammlung_organisator: 'TSV Musterdorf' },
    ])
    expect(result).toEqual([
      { id: 'p1', typ: 'sammlung_altpapier', datum: '2026-08-01', zeitpunkt: '2026-08-01T09:00:00+00:00', organisator: 'TSV Musterdorf' },
    ])
  })

  it('filtert Posts ohne Sammlungsart oder -datum heraus', () => {
    const result = mapSammlungPostsZuTerminen([
      { id: 'p2', sammlung_art: null, sammlung_datum: null, sammlung_organisator: null },
    ])
    expect(result).toEqual([])
  })

  it('filtert Posts mit unbekannter Sammlungsart heraus', () => {
    const result = mapSammlungPostsZuTerminen([
      { id: 'p3', sammlung_art: 'plastik', sammlung_datum: '2026-08-01', sammlung_organisator: 'Test' },
    ])
    expect(result).toEqual([])
  })
})

describe('getTerminAnzeigeConfig', () => {
  it('findet die Konfiguration für einen Sammlungs-Typ', () => {
    const config = getTerminAnzeigeConfig('sammlung_altglas')
    expect(config?.label).toBe('Altglassammlung')
  })

  it('findet die Konfiguration für einen regulären Abfuhr-Typ', () => {
    const config = getTerminAnzeigeConfig('biomuell')
    expect(config?.label).toBe('Biomüll')
  })

  it('gibt null für unbekannte Typen zurück', () => {
    expect(getTerminAnzeigeConfig('unbekannt')).toBeNull()
  })
})
