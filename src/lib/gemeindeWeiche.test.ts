import { describe, it, expect } from 'vitest'
import { zielFuerFremdeGemeinde } from './gemeindeWeiche'

describe('zielFuerFremdeGemeinde', () => {
  const basis = { host: 'ehningen.dorfly.de', hostSlug: 'ehningen', proto: 'https' }

  it('leitet auf die eigene Gemeinde um, wenn das Profil zu einer anderen gehört', () => {
    expect(zielFuerFremdeGemeinde({ ...basis, profilSlug: 'musterbach', role: 'buerger' }))
      .toBe('https://musterbach.dorfly.de/home')
  })

  it('bleibt, wenn Profil und Subdomain übereinstimmen', () => {
    expect(zielFuerFremdeGemeinde({ ...basis, profilSlug: 'ehningen', role: 'buerger' })).toBeNull()
  })

  it('nimmt Super-Admins aus — sie dürfen jede Gemeinde ansehen', () => {
    expect(zielFuerFremdeGemeinde({ ...basis, profilSlug: 'musterbach', role: 'super_admin' })).toBeNull()
  })

  it('bleibt, wenn das Profil keine Gemeinde hat', () => {
    expect(zielFuerFremdeGemeinde({ ...basis, profilSlug: null, role: 'buerger' })).toBeNull()
  })

  it('behält Protokoll und Port bei lokalen Subdomains', () => {
    expect(zielFuerFremdeGemeinde({
      host: 'ehningen.localhost:3000', hostSlug: 'ehningen', proto: 'http',
      profilSlug: 'musterbach', role: 'buerger',
    })).toBe('http://musterbach.localhost:3000/home')
  })

  it('leitet nicht um, wenn der Slug nicht aus der Subdomain stammt (localhost mit Default-Slug)', () => {
    // Sonst gäbe es kein Ziel, und eine Umleitung auf denselben Host liefe im Kreis.
    expect(zielFuerFremdeGemeinde({
      host: 'localhost:3000', hostSlug: 'ehningen', proto: 'http',
      profilSlug: 'musterbach', role: 'buerger',
    })).toBeNull()
  })

  it('leitet nicht um, wenn der Host keine Gemeinde trägt', () => {
    expect(zielFuerFremdeGemeinde({
      host: 'preview.vercel.app', hostSlug: null, proto: 'https',
      profilSlug: 'musterbach', role: 'buerger',
    })).toBeNull()
  })

  it('ignoriert Profil-Slugs, die keine gültigen Subdomains sind', () => {
    expect(zielFuerFremdeGemeinde({ ...basis, profilSlug: 'evil.com/x', role: 'buerger' })).toBeNull()
  })
})
