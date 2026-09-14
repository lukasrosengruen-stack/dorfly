import { describe, it, expect } from 'vitest'
import { umfrageErgebnisseSchema } from './validations'

describe('umfrageErgebnisseSchema', () => {
  it('akzeptiert eine gueltige UUID', () => {
    const r = umfrageErgebnisseSchema.safeParse({
      umfrageId: '3f0c2a1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b',
    })
    expect(r.success).toBe(true)
  })

  it('lehnt eine ungueltige UUID ab', () => {
    expect(umfrageErgebnisseSchema.safeParse({ umfrageId: 'abc' }).success).toBe(false)
  })

  it('lehnt einen fehlenden Parameter ab', () => {
    expect(umfrageErgebnisseSchema.safeParse({ umfrageId: null }).success).toBe(false)
  })
})
