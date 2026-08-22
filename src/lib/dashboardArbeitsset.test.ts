import { describe, it, expect } from 'vitest'
import { mergeArbeitsset } from './dashboardArbeitsset'

type Zeile = { id: string; created_at: string | null; quelle?: string }
const datum = (z: Zeile) => z.created_at

describe('mergeArbeitsset', () => {
  it('gibt bei leerer Eingabe eine leere Liste zurueck', () => {
    expect(mergeArbeitsset<Zeile>([], datum)).toEqual([])
    expect(mergeArbeitsset<Zeile>([[], []], datum)).toEqual([])
  })

  it('sortiert neueste zuerst', () => {
    const a = { id: 'a', created_at: '2026-08-01T10:00:00Z' }
    const b = { id: 'b', created_at: '2026-08-03T10:00:00Z' }
    const c = { id: 'c', created_at: '2026-08-02T10:00:00Z' }
    expect(mergeArbeitsset([[a, b, c]], datum).map(z => z.id)).toEqual(['b', 'c', 'a'])
  })

  it('entdoppelt ueber die id, auch wenn eine Zeile in mehreren Gruppen steckt', () => {
    const neu = { id: 'a', created_at: '2026-08-03T10:00:00Z' }
    const gleicheZeile = { id: 'a', created_at: '2026-08-03T10:00:00Z' }
    const alt = { id: 'b', created_at: '2026-01-01T10:00:00Z' }
    const ergebnis = mergeArbeitsset([[neu], [gleicheZeile, alt]], datum)
    expect(ergebnis.map(z => z.id)).toEqual(['a', 'b'])
  })

  it('behaelt bei Duplikaten die Zeile aus der ersten Gruppe', () => {
    const ausArbeitsset = { id: 'a', created_at: '2026-08-03T10:00:00Z', quelle: 'arbeitsset' }
    const ausStatusabfrage = { id: 'a', created_at: '2026-08-03T10:00:00Z', quelle: 'statusabfrage' }
    const ergebnis = mergeArbeitsset([[ausArbeitsset], [ausStatusabfrage]], datum)
    expect(ergebnis).toHaveLength(1)
    expect(ergebnis[0].quelle).toBe('arbeitsset')
  })

  it('behaelt den offenen Altfall, der nicht im Arbeitsset steckt', () => {
    const neueste = [
      { id: 'neu1', created_at: '2026-08-20T10:00:00Z' },
      { id: 'neu2', created_at: '2026-08-19T10:00:00Z' },
    ]
    const offeneAltfaelle = [{ id: 'alt', created_at: '2026-02-01T10:00:00Z' }]
    const ergebnis = mergeArbeitsset([neueste, offeneAltfaelle], datum)
    expect(ergebnis.map(z => z.id)).toEqual(['neu1', 'neu2', 'alt'])
  })

  it('sortiert Zeilen ohne Datum ans Ende', () => {
    const ohne = { id: 'ohne', created_at: null }
    const mit = { id: 'mit', created_at: '2026-08-01T10:00:00Z' }
    expect(mergeArbeitsset([[ohne, mit]], datum).map(z => z.id)).toEqual(['mit', 'ohne'])
  })
})
