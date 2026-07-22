import { describe, it, expect } from 'vitest'
import { registerFormSchema } from './schema'

const validPayload = {
  email: 'anna@example.com',
  password: 'geheim123',
  vorname: '',
  nachname: '',
  ageConfirmed: true as const,
  termsAccepted: true as const,
}

describe('registerFormSchema', () => {
  it('akzeptiert ein vollständig gültiges Formular', () => {
    const result = registerFormSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
  })

  it('lehnt eine ungültige E-Mail-Adresse ab', () => {
    const result = registerFormSchema.safeParse({ ...validPayload, email: 'keine-email' })
    expect(result.success).toBe(false)
  })

  it('lehnt ein leeres Passwort ab', () => {
    const result = registerFormSchema.safeParse({ ...validPayload, password: '' })
    expect(result.success).toBe(false)
  })

  it('lehnt ab, wenn die Altersbestätigung fehlt', () => {
    const result = registerFormSchema.safeParse({ ...validPayload, ageConfirmed: false })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Bitte bestätige, dass du mindestens 16 Jahre alt bist.')
    }
  })

  it('lehnt ab, wenn die Zustimmung zu den Nutzungsbedingungen fehlt', () => {
    const result = registerFormSchema.safeParse({ ...validPayload, termsAccepted: false })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Bitte akzeptiere die Nutzungsbedingungen und nimm die Datenschutzerklärung zur Kenntnis.')
    }
  })
})
