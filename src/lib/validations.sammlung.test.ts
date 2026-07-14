import { describe, it, expect } from 'vitest'
import { vereinPostSchema, vereinPostUpdateSchema } from './validations'

const basePayload = {
  vereinId: '11111111-1111-1111-8111-111111111111',
  titel: 'Altpapiersammlung Frühjahr',
  inhalt: 'Wir sammeln am Samstag Altpapier ein.',
}

describe('vereinPostSchema mit tag "sammlung"', () => {
  it('lehnt einen Sammlung-Beitrag ohne sammlung_art/datum/organisator ab', () => {
    const result = vereinPostSchema.safeParse({ ...basePayload, tag: 'sammlung' })
    expect(result.success).toBe(false)
  })

  it('akzeptiert einen vollständigen Sammlung-Beitrag', () => {
    const result = vereinPostSchema.safeParse({
      ...basePayload,
      tag: 'sammlung',
      sammlungArt: 'altpapier',
      sammlungDatum: '2026-08-01',
      sammlungOrganisator: 'TSV Musterdorf',
    })
    expect(result.success).toBe(true)
  })

  it('lehnt einen Sammlung-Beitrag mit nur teilweise ausgefüllten Feldern ab', () => {
    const result = vereinPostSchema.safeParse({
      ...basePayload,
      tag: 'sammlung',
      sammlungArt: 'altpapier',
      // sammlungDatum und sammlungOrganisator fehlen
    })
    expect(result.success).toBe(false)
  })

  it('lehnt eine ungültige sammlungArt ab', () => {
    const result = vereinPostSchema.safeParse({
      ...basePayload,
      tag: 'sammlung',
      sammlungArt: 'plastik',
      sammlungDatum: '2026-08-01',
      sammlungOrganisator: 'TSV Musterdorf',
    })
    expect(result.success).toBe(false)
  })

  it('erlaubt weiterhin einen normalen Nachricht-Beitrag ohne Sammlung-Felder', () => {
    const result = vereinPostSchema.safeParse({ ...basePayload, tag: 'nachricht' })
    expect(result.success).toBe(true)
  })
})

describe('vereinPostUpdateSchema erlaubt tag "sammlung"', () => {
  it('akzeptiert ein Update mit tag "sammlung" (nur Titel/Inhalt geändert)', () => {
    const result = vereinPostUpdateSchema.safeParse({
      postId: '11111111-1111-1111-8111-111111111111',
      titel: 'Korrigierter Titel',
      inhalt: 'Korrigierter Inhalt',
      tag: 'sammlung',
    })
    expect(result.success).toBe(true)
  })
})
