import { describe, expect, it } from 'vitest'
import { berlinZeit, naechsterTag } from './berlinZeit'

describe('berlinZeit', () => {
  it('rechnet im Winter mit UTC+1', () => {
    expect(berlinZeit(new Date('2026-01-15T17:00:00Z'))).toEqual({ datum: '2026-01-15', stunde: 18 })
  })

  it('rechnet im Sommer mit UTC+2', () => {
    expect(berlinZeit(new Date('2026-07-15T16:00:00Z'))).toEqual({ datum: '2026-07-15', stunde: 18 })
  })

  it('wechselt kurz nach Mitternacht deutscher Zeit schon auf den neuen Tag', () => {
    expect(berlinZeit(new Date('2026-07-15T22:30:00Z'))).toEqual({ datum: '2026-07-16', stunde: 0 })
  })

  it('stimmt am Tag der Zeitumstellung im Fruehjahr', () => {
    // 29.03.2026: um 02:00 springt die Uhr auf 03:00, abends gilt schon Sommerzeit
    expect(berlinZeit(new Date('2026-03-29T16:00:00Z')).stunde).toBe(18)
  })

  it('stimmt am Tag der Zeitumstellung im Herbst', () => {
    // 25.10.2026: um 03:00 springt die Uhr auf 02:00, abends gilt schon Winterzeit
    expect(berlinZeit(new Date('2026-10-25T17:00:00Z')).stunde).toBe(18)
  })
})

describe('naechsterTag', () => {
  it('zaehlt ueber Monats- und Jahresgrenzen', () => {
    expect(naechsterTag('2026-01-31')).toBe('2026-02-01')
    expect(naechsterTag('2026-12-31')).toBe('2027-01-01')
  })

  it('liefert auch an den Tagen der Zeitumstellung genau den Folgetag', () => {
    expect(naechsterTag('2026-03-28')).toBe('2026-03-29')
    expect(naechsterTag('2026-10-24')).toBe('2026-10-25')
  })
})
