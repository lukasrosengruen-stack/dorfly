// src/features/warnmeldungen/dwd.test.ts
import { describe, it, expect } from 'vitest'
import { filterActiveAlerts, buildPostContent } from './dwd'
import type { DwdAlert } from './types'

function mockAlert(overrides: Partial<DwdAlert> = {}): DwdAlert {
  return {
    id: 'alert-1',
    event: 'STARKREGEN',
    headline: 'Amtliche WARNUNG vor STARKREGEN',
    description: 'Örtlich Starkregen zwischen 20 und 30 l/m².',
    instruction: 'Keller leerpumpen.',
    severity: 'Moderate',
    status: 'Actual',
    message_type: 'Alert',
    effective: '2024-01-15T10:00:00+00:00',
    expires: '2024-01-15T22:00:00+00:00',
    warn_cell_ids: ['DE-BW-08135000'],
    ...overrides,
  }
}

describe('filterActiveAlerts', () => {
  it('includes Moderate severity active alerts', () => {
    expect(filterActiveAlerts([mockAlert()])).toHaveLength(1)
  })

  it('excludes Minor severity alerts', () => {
    expect(filterActiveAlerts([mockAlert({ severity: 'Minor' })])).toHaveLength(0)
  })

  it('includes Severe and Extreme', () => {
    const alerts = [
      mockAlert({ severity: 'Severe' }),
      mockAlert({ id: 'alert-2', severity: 'Extreme' }),
    ]
    expect(filterActiveAlerts(alerts)).toHaveLength(2)
  })

  it('excludes cancelled messages', () => {
    expect(filterActiveAlerts([mockAlert({ message_type: 'Cancel' })])).toHaveLength(0)
  })

  it('excludes non-Actual status', () => {
    expect(filterActiveAlerts([mockAlert({ status: 'Exercise' })])).toHaveLength(0)
  })
})

describe('buildPostContent', () => {
  it('builds titel from headline', () => {
    const { titel } = buildPostContent(mockAlert())
    expect(titel).toBe('Unwetterwarnung: Amtliche WARNUNG vor STARKREGEN')
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
    const { inhalt } = buildPostContent(mockAlert({ description: null }))
    expect(typeof inhalt).toBe('string')
    expect(inhalt.length).toBeGreaterThan(0)
  })

  it('handles null expires gracefully', () => {
    const { inhalt } = buildPostContent(mockAlert({ expires: null }))
    expect(typeof inhalt).toBe('string')
  })
})
