import { describe, it, expect } from 'vitest'
import { getContrastRatio } from './contrast'

describe('getContrastRatio', () => {
  it('liefert 21:1 für Schwarz auf Weiß', () => {
    expect(getContrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
  })

  it('liefert 1:1 für identische Farben', () => {
    expect(getContrastRatio('#e8a020', '#e8a020')).toBeCloseTo(1, 1)
  })

  it('ist symmetrisch (Reihenfolge der Argumente egal)', () => {
    const a = getContrastRatio('#0f2d6b', '#ffffff')
    const b = getContrastRatio('#ffffff', '#0f2d6b')
    expect(a).toBeCloseTo(b, 5)
  })

  it('wirft bei ungültigem Hex-Format', () => {
    expect(() => getContrastRatio('not-a-color', '#ffffff')).toThrow()
    expect(() => getContrastRatio('#ffffff', 'not-a-color')).toThrow()
    expect(() => getContrastRatio('#fff', '#ffffff')).toThrow()
  })

  it('liefert ~4.5:1 für #767676 auf Weiß (WCAG-AA-Referenzpaar)', () => {
    expect(getContrastRatio('#767676', '#ffffff')).toBeCloseTo(4.5, 1)
  })
})
