import { describe, it, expect } from 'vitest'
import { buildThemeStyle } from './buildThemeStyle'

describe('buildThemeStyle', () => {
  it('gibt null zurück, wenn primaryColor und accentColor beide fehlen', () => {
    expect(buildThemeStyle(null, null)).toBeNull()
    expect(buildThemeStyle(undefined, undefined)).toBeNull()
    expect(buildThemeStyle()).toBeNull()
  })

  it('gibt null zurück, wenn beide Farben fehlerhaft sind', () => {
    expect(buildThemeStyle('not-a-color', 'also-not-a-color')).toBeNull()
  })

  it('erzeugt --gemeinde-primary-* Deklarationen bei gültiger primaryColor', () => {
    const style = buildThemeStyle('#0f2d6b', null)
    expect(style).not.toBeNull()
    expect(style).toContain('--gemeinde-primary-500: #0f2d6b;')
    expect(style).toMatch(/^:root \{.*\}$/)
  })

  it('erzeugt sowohl --gemeinde-primary-* als auch --gemeinde-accent-* Deklarationen, wenn beide gültig sind', () => {
    const style = buildThemeStyle('#0f2d6b', '#e8a020')
    expect(style).not.toBeNull()
    expect(style).toContain('--gemeinde-primary-500: #0f2d6b;')
    expect(style).toContain('--gemeinde-accent-500: #e8a020;')
  })

  it('ignoriert eine fehlerhafte accentColor, behält aber gültige primaryColor-Deklarationen', () => {
    const style = buildThemeStyle('#0f2d6b', 'not-a-color')
    expect(style).not.toBeNull()
    expect(style).toContain('--gemeinde-primary-500: #0f2d6b;')
    expect(style).not.toContain('--gemeinde-accent-')
  })
})
