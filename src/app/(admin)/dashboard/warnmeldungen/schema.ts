import { z } from 'zod'

export const warnmeldungSchema = z.object({
  titel: z.string().min(1, 'Titel erforderlich').max(200),
  inhalt: z.string().min(1, 'Beschreibung erforderlich'),
  severity: z.number().int().min(1).max(4),
  sendPush: z.boolean(),
})

export type WarnmeldungFormValues = z.infer<typeof warnmeldungSchema>
