import { z } from 'zod'

export const registerFormSchema = z.object({
  email: z.string().email('Bitte gültige E-Mail-Adresse eingeben'),
  password: z.string().min(1, 'Bitte Passwort eingeben'),
  vorname: z.string().optional(),
  nachname: z.string().optional(),
  ageConfirmed: z.boolean().refine(v => v === true, { message: 'Bitte bestätige, dass du mindestens 16 Jahre alt bist.' }),
  termsAccepted: z.boolean().refine(v => v === true, { message: 'Bitte akzeptiere die Nutzungsbedingungen und nimm die Datenschutzerklärung zur Kenntnis.' }),
})

export type RegisterFormValues = z.infer<typeof registerFormSchema>
