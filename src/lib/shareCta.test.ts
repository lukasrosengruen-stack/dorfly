import { describe, it, expect } from 'vitest'
import { shareCtaZiele } from './shareCta'

describe('shareCtaZiele', () => {
  it('bietet mit Gemeinde-Kontext Registrierung und Gastzugang an', () => {
    const ziele = shareCtaZiele('ehningen')

    expect(ziele.primaer).toBe('/login')
    expect(ziele.sekundaer).toBe('/feed')
  })

  it('fuehrt ohne Gemeinde-Kontext nur auf die Homepage', () => {
    // Auf der Apex-Domain gibt es keinen Slug. Die Middleware leitet /feed dann
    // nach /homepage um — ein Gast-CTA ins Leere waere schlechter als keiner.
    const ziele = shareCtaZiele(null)

    expect(ziele.primaer).toBe('/homepage')
    expect(ziele.sekundaer).toBeNull()
  })

  it('behandelt einen leeren Slug wie einen fehlenden', () => {
    const ziele = shareCtaZiele('')

    expect(ziele.primaer).toBe('/homepage')
    expect(ziele.sekundaer).toBeNull()
  })
})
