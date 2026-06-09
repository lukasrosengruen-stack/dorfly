import { describe, it, expect } from 'vitest'
import { normalizeSocialUsername, buildSocialUrl } from './social'

describe('normalizeSocialUsername', () => {
  it('entfernt führendes @', () => {
    expect(normalizeSocialUsername('@lukas_rosen')).toBe('lukas_rosen')
  })
  it('lässt Username ohne @ unverändert', () => {
    expect(normalizeSocialUsername('lukas_rosen')).toBe('lukas_rosen')
  })
  it('gibt null zurück für leeren String', () => {
    expect(normalizeSocialUsername('')).toBeNull()
  })
  it('gibt null zurück für null', () => {
    expect(normalizeSocialUsername(null)).toBeNull()
  })
  it('trimmt Whitespace', () => {
    expect(normalizeSocialUsername('  lukas_rosen  ')).toBe('lukas_rosen')
  })
  it('trimmt Whitespace und entfernt @', () => {
    expect(normalizeSocialUsername('  @lukas_rosen  ')).toBe('lukas_rosen')
  })
})

describe('buildSocialUrl', () => {
  it('baut X-URL korrekt', () => {
    expect(buildSocialUrl('x', 'lukas_rosen')).toBe('https://x.com/lukas_rosen')
  })
  it('baut Facebook-URL korrekt', () => {
    expect(buildSocialUrl('facebook', 'lukas.rosen')).toBe('https://facebook.com/lukas.rosen')
  })
  it('baut Instagram-URL korrekt', () => {
    expect(buildSocialUrl('instagram', 'lukas_rosen')).toBe('https://instagram.com/lukas_rosen')
  })
  it('baut TikTok-URL mit @ korrekt', () => {
    expect(buildSocialUrl('tiktok', 'lukas_rosen')).toBe('https://tiktok.com/@lukas_rosen')
  })
  it('entfernt führendes @ aus dem Username', () => {
    expect(buildSocialUrl('instagram', '@lukas_rosen')).toBe('https://instagram.com/lukas_rosen')
  })
})
