import { describe, it, expect } from 'vitest'
import { dashboardSucheSchema } from './validations'

describe('dashboardSucheSchema', () => {
  it('akzeptiert gueltige Eingaben', () => {
    const r = dashboardSucheSchema.safeParse({ typ: 'beitraege', q: 'Sommerfest' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.q).toBe('Sommerfest')
  })

  it('entfernt umgebende Leerzeichen', () => {
    const r = dashboardSucheSchema.safeParse({ typ: 'maengel', q: '  Laterne  ' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.q).toBe('Laterne')
  })

  it('lehnt einen unbekannten Typ ab', () => {
    expect(dashboardSucheSchema.safeParse({ typ: 'umfragen', q: 'test' }).success).toBe(false)
  })

  it('lehnt weniger als zwei Zeichen ab', () => {
    expect(dashboardSucheSchema.safeParse({ typ: 'fragen', q: 'a' }).success).toBe(false)
  })

  it('lehnt ab, wenn nur Leerzeichen uebrig bleiben', () => {
    expect(dashboardSucheSchema.safeParse({ typ: 'fragen', q: '   ' }).success).toBe(false)
  })

  it('lehnt mehr als 100 Zeichen ab', () => {
    const r = dashboardSucheSchema.safeParse({ typ: 'fragen', q: 'x'.repeat(101) })
    expect(r.success).toBe(false)
  })

  it('lehnt fehlende Parameter ab', () => {
    expect(dashboardSucheSchema.safeParse({ typ: null, q: null }).success).toBe(false)
  })
})
