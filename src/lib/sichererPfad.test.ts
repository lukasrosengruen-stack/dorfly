import { describe, expect, it } from 'vitest'
import { sichererPfad } from './sichererPfad'

describe('sichererPfad', () => {
  it('lässt interne Pfade durch', () => {
    expect(sichererPfad('/home')).toBe('/home')
    expect(sichererPfad('/passwort-zuruecksetzen')).toBe('/passwort-zuruecksetzen')
    expect(sichererPfad('/feed?tab=alle')).toBe('/feed?tab=alle')
  })

  it('dekodiert vor der Prüfung', () => {
    expect(sichererPfad('%2Fpasswort-zuruecksetzen')).toBe('/passwort-zuruecksetzen')
    expect(sichererPfad('%2F%2Fevil.example')).toBeNull()
  })

  it('weist absolute Adressen ab', () => {
    expect(sichererPfad('https://evil.example')).toBeNull()
    expect(sichererPfad('http://evil.example/home')).toBeNull()
  })

  it('weist protokollrelative Adressen ab', () => {
    expect(sichererPfad('//evil.example')).toBeNull()
    expect(sichererPfad('/\\evil.example')).toBeNull()
  })

  it('weist Leeres, Relatives und kaputtes Encoding ab', () => {
    expect(sichererPfad(null)).toBeNull()
    expect(sichererPfad(undefined)).toBeNull()
    expect(sichererPfad('')).toBeNull()
    expect(sichererPfad('home')).toBeNull()
    expect(sichererPfad('%')).toBeNull()
  })
})
