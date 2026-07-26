import { describe, it, expect } from 'vitest'
import { isGuestRoute } from './guestRoutes'

describe('isGuestRoute', () => {
  it('erlaubt Gast-Basisrouten', () => {
    expect(isGuestRoute('/feed')).toBe(true)
    expect(isGuestRoute('/home')).toBe(true)
    expect(isGuestRoute('/warnmeldungen')).toBe(true)
    expect(isGuestRoute('/veranstaltungen')).toBe(true)
    expect(isGuestRoute('/abfallkalender')).toBe(true)
    expect(isGuestRoute('/vereine')).toBe(true)
    expect(isGuestRoute('/lokale-angebote')).toBe(true)
  })

  it('erlaubt Unterpfade von Gast-Routen', () => {
    expect(isGuestRoute('/vereine/123')).toBe(true)
    expect(isGuestRoute('/lokale-angebote/abc')).toBe(true)
  })

  it('blockt geschützte Routen', () => {
    expect(isGuestRoute('/umfragen')).toBe(false)
    expect(isGuestRoute('/maengel')).toBe(false)
    expect(isGuestRoute('/gemeinderat')).toBe(false)
    expect(isGuestRoute('/buergermeister')).toBe(false)
    expect(isGuestRoute('/profil')).toBe(false)
    expect(isGuestRoute('/dashboard')).toBe(false)
  })

  it('matcht keine Präfix-Kollisionen', () => {
    // '/feedback' darf NICHT als '/feed' durchgehen
    expect(isGuestRoute('/feedback')).toBe(false)
  })
})
