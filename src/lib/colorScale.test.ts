import { describe, it, expect } from 'vitest'
import { generateColorScale } from './colorScale'

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

describe('generateColorScale', () => {
  it('behält die Eingabefarbe exakt (± Rundung) als 500-Stufe', () => {
    const scale = generateColorScale('#0f2d6b')
    const [r1, g1, b1] = hexToRgb(scale['500'])
    const [r2, g2, b2] = hexToRgb('#0f2d6b')
    expect(Math.abs(r1 - r2)).toBeLessThanOrEqual(1)
    expect(Math.abs(g1 - g2)).toBeLessThanOrEqual(1)
    expect(Math.abs(b1 - b2)).toBeLessThanOrEqual(1)
  })

  it('wird von 50 nach 900 monoton dunkler', () => {
    const scale = generateColorScale('#0f2d6b')
    const luminance = (hex: string) => {
      const [r, g, b] = hexToRgb(hex)
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const order: (keyof typeof scale)[] = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900']
    for (let i = 1; i < order.length; i++) {
      expect(luminance(scale[order[i]])).toBeLessThan(luminance(scale[order[i - 1]]))
    }
  })

  it('gibt gültige 6-stellige Hex-Codes für alle Stufen zurück', () => {
    const scale = generateColorScale('#e8a020')
    for (const hex of Object.values(scale)) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('wirft bei ungültigem Hex-Format', () => {
    expect(() => generateColorScale('not-a-color')).toThrow()
    expect(() => generateColorScale('#fff')).toThrow()
  })

  it('behandelt Schwarz, Weiß und Grau ohne Fehler', () => {
    expect(() => generateColorScale('#000000')).not.toThrow()
    expect(() => generateColorScale('#ffffff')).not.toThrow()
    expect(() => generateColorScale('#808080')).not.toThrow()
  })
})
