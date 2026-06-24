// src/features/warnmeldungen/dwd.test.ts
import { describe, it, expect } from 'vitest'
import { filterActiveAlerts, buildPostContent } from './dwd'
import type { DwdAlert } from './types'

function mockAlert(overrides: Partial<DwdAlert> = {}): DwdAlert {
  return {
    id: 2313758,
    alert_id: '2.49.0.0.276.0.DWD.PVW.test',
    event_de: 'STARKREGEN',
    headline_de: 'Amtliche WARNUNG vor STARKREGEN',
    description_de: 'Örtlich Starkregen zwischen 20 und 30 l/m².',
    instruction_de: 'Keller leerpumpen.',
    severity: 'moderate',
    status: 'actual',
    effective: '2024-01-15T10:00:00+00:00',
    expires: '2024-01-15T22:00:00+00:00',
    ...overrides,
  }
}

describe('filterActiveAlerts', () => {
  it('includes active alerts', () => {
    expect(filterActiveAlerts([mockAlert()])).toHaveLength(1)
  })

  it('includes minor severity alerts', () => {
    expect(filterActiveAlerts([mockAlert({ severity: 'minor' })])).toHaveLength(1)
  })

  it('includes severe and extreme', () => {
    const alerts = [
      mockAlert({ severity: 'severe' }),
      mockAlert({ id: 2313759, severity: 'extreme' }),
    ]
    expect(filterActiveAlerts(alerts)).toHaveLength(2)
  })

  it('excludes non-actual status', () => {
    expect(filterActiveAlerts([mockAlert({ status: 'exercise' })])).toHaveLength(0)
  })
})

describe('buildPostContent', () => {
  it('builds titel from headline_de', () => {
    const { titel } = buildPostContent(mockAlert())
    expect(titel).toBe('Amtliche WARNUNG vor STARKREGEN')
  })

  it('includes description in inhalt', () => {
    const { inhalt } = buildPostContent(mockAlert())
    expect(inhalt).toContain('Örtlich Starkregen')
  })

  it('includes instruction when present', () => {
    const { inhalt } = buildPostContent(mockAlert())
    expect(inhalt).toContain('Keller leerpumpen')
  })

  it('handles null description gracefully', () => {
    const { inhalt } = buildPostContent(mockAlert({ description_de: null }))
    expect(typeof inhalt).toBe('string')
    expect(inhalt.length).toBeGreaterThan(0)
  })

  it('handles null expires gracefully', () => {
    const { inhalt } = buildPostContent(mockAlert({ expires: null }))
    expect(typeof inhalt).toBe('string')
  })
})
