import { describe, it, expect } from 'vitest'
import { getFeatures, isFeatureAktiv, getBuergermeisterLabel } from './features'

describe('getFeatures', () => {
  it('gibt leeres Objekt zurück wenn gemeinde null ist', () => {
    expect(getFeatures(null)).toEqual({})
  })

  it('gibt leeres Objekt zurück wenn features null ist', () => {
    expect(getFeatures({ features: null })).toEqual({})
  })

  it('gibt features zurück wenn vorhanden', () => {
    const gemeinde = { features: { abfallkalender: true, umfragen: false } }
    expect(getFeatures(gemeinde)).toEqual({ abfallkalender: true, umfragen: false })
  })
})

describe('isFeatureAktiv', () => {
  it('gibt false zurück wenn gemeinde null ist', () => {
    expect(isFeatureAktiv(null, 'abfallkalender')).toBe(false)
  })

  it('gibt false zurück wenn feature nicht gesetzt ist', () => {
    expect(isFeatureAktiv({ features: {} }, 'abfallkalender')).toBe(false)
  })

  it('gibt false zurück wenn feature explizit false ist', () => {
    expect(isFeatureAktiv({ features: { abfallkalender: false } }, 'abfallkalender')).toBe(false)
  })

  it('gibt true zurück wenn feature aktiviert ist', () => {
    expect(isFeatureAktiv({ features: { abfallkalender: true } }, 'abfallkalender')).toBe(true)
  })
})

describe('getBuergermeisterLabel', () => {
  it('gibt Bürgermeister-Labels zurück wenn nicht konfiguriert', () => {
    const label = getBuergermeisterLabel(null)
    expect(label.long).toBe('Frag den Bürgermeister')
    expect(label.short).toBe('Frag BM')
  })

  it('gibt Verwaltungs-Labels zurück wenn verwaltung konfiguriert', () => {
    const label = getBuergermeisterLabel({ features: { buergermeisterLabel: 'verwaltung' } })
    expect(label.long).toBe('Frag die Verwaltung')
    expect(label.short).toBe('Verwaltung')
  })

  it('gibt Bürgermeister-Labels zurück wenn buergermeister konfiguriert', () => {
    const label = getBuergermeisterLabel({ features: { buergermeisterLabel: 'buergermeister' } })
    expect(label.long).toBe('Frag den Bürgermeister')
    expect(label.short).toBe('Frag BM')
  })
})
