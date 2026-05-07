/**
 * Zod-Validierungsschemas für alle API-Routes
 *
 * Jede API-Route validiert ihre Eingabe mit einem dieser Schemas.
 * Das verhindert ungültige Daten und gibt klare Fehlermeldungen zurück.
 */

import { z } from 'zod'
import { NextResponse } from 'next/server'

// ── Basis-Primitives ──────────────────────────────────────────────────────────

const uuid = z.string().uuid('Ungültige ID')
const nonEmpty = z.string().min(1, 'Darf nicht leer sein')

// ── Validator-Hilfsfunktion ───────────────────────────────────────────────────

/**
 * Validiert Eingabedaten gegen ein Zod-Schema.
 * Gibt entweder die validierten Daten oder eine NextResponse mit Fehler zurück.
 *
 * @example
 * const result = validate(postFreigebenSchema, await req.json())
 * if (!result.success) return result.error
 * const { postId, action } = result.data
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; error: NextResponse } {
  const result = schema.safeParse(data)
  if (!result.success) {
    return {
      success: false,
      error: NextResponse.json(
        {
          error: 'Ungültige Eingabe',
          details: result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })),
        },
        { status: 400 },
      ),
    }
  }
  return { success: true, data: result.data }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const registrierenSchema = z.object({
  userId: uuid,
  vorname: z.string().optional(),
  nachname: z.string().optional(),
})

// ── Fragen (Frag den Bürgermeister) ──────────────────────────────────────────

export const frageUpdateSchema = z.object({
  id: uuid,
  antwort: nonEmpty.max(5000),
})

export const frageDeleteSchema = z.object({
  id: uuid,
})

// ── Gemeinde ──────────────────────────────────────────────────────────────────

export const gemeindeAktualisierenSchema = z.object({
  gemeindeId: uuid,
  einwohner: z.number().int().positive().nullable(),
  haushalte: z.number().int().positive().nullable(),
})

// ── Gemeinderat ───────────────────────────────────────────────────────────────

export const gemeinderatFrageSchema = z.object({
  gemeinderatId: uuid,
  frage: nonEmpty.max(2000),
  gemeindeId: uuid,
})

export const gemeinderatAntwortSchema = z.object({
  frageId: uuid,
  antwort: nonEmpty.max(5000),
})

// ── Mängel ────────────────────────────────────────────────────────────────────

export const maengelStatusSchema = z.object({
  mangelId: uuid,
  status: z.enum(['offen', 'in_bearbeitung', 'erledigt']),
  nachricht: z.string().max(2000).optional(),
})

export const maengelDeleteSchema = z.object({
  id: uuid,
})

// ── Benachrichtigungen ────────────────────────────────────────────────────────

export const notificationSendSchema = z.object({
  title: nonEmpty.max(100),
  message: nonEmpty.max(500),
  url: z.string().optional(),
})

// ── Posts ─────────────────────────────────────────────────────────────────────

export const postFreigebenSchema = z.object({
  postId: uuid,
  action: z.enum(['publish', 'reject']),
  sichtbarkeit: z.enum(['alle', 'abonnenten']).optional(),
  rejectionReason: z.string().min(1).max(1000).optional(),
})

export const postDeleteSchema = z.object({
  id: uuid,
})

export const postUpdateSchema = z.object({
  id: uuid,
  titel: z.string().max(200).optional(),
  inhalt: z.string().max(10000).optional(),
  pinned: z.boolean().optional(),
  tag: z.string().nullable().optional(),
  status: z.enum(['pending', 'published', 'rejected']).optional(),
  publish_at: z.string().nullable().optional(),
})

// ── Umfragen ──────────────────────────────────────────────────────────────────

export const umfrageAbstimmenSchema = z.object({
  umfrageId: uuid,
  antworten: z
    .array(
      z.object({
        frage_id: uuid,
        antwort_text: z.string().optional(),
        option_id: z.string().optional(),
      }),
    )
    .min(1, 'Mindestens eine Antwort erforderlich'),
})

export const umfrageErstellenSchema = z.object({
  titel: nonEmpty.max(200),
  beschreibung: z.string().max(1000).optional(),
  enddatum: z.string().min(1, 'Enddatum erforderlich'),
  gemeindeId: uuid,
  fragen: z
    .array(
      z.object({
        reihenfolge: z.number().int().min(0),
        frage_text: nonEmpty.max(500),
        typ: z.enum(['ja_nein', 'einzelauswahl', 'mehrfachauswahl', 'bewertung']),
        umfrage_optionen: z
          .array(
            z.object({
              option_text: nonEmpty.max(200),
              reihenfolge: z.number().int().min(0),
            }),
          )
          .optional(),
      }),
    )
    .min(1, 'Mindestens eine Frage erforderlich'),
})

export const umfrageLoeschenSchema = z.object({
  umfrageId: uuid,
})

export const umfrageBearbeitenSchema = z.object({
  id: uuid,
  titel: z.string().max(200).optional(),
  beschreibung: z.string().max(1000).nullable().optional(),
  enddatum: z.string().optional(),
})

// ── Gewerbe ───────────────────────────────────────────────────────────────────

export const gewerbeProfilSchema = z.object({
  gewerbeId: uuid,
  name: nonEmpty.max(200),
  branche_id: z.string().uuid().nullable().optional(),
  beschreibung: z.string().max(2000).nullable().optional(),
  adresse: z.string().max(500).nullable().optional(),
  oeffnungszeiten: z.string().max(1000).nullable().optional(),
  website: z.union([z.url(), z.literal(''), z.null()]).optional(),
  logo_url: z.union([z.url(), z.null()]).optional(),
})

export const gewerbePostSchema = z.object({
  gewerbeId: uuid,
  text: nonEmpty.max(5000),
  bildUrl: z.url().optional(),
  ablaufdatum: z.string().optional(),
})

export const gewerbePostUpdateSchema = z.object({
  postId: uuid,
  text: nonEmpty.max(5000),
  bildUrl: z.union([z.url(), z.null()]).optional(),
  ablaufdatum: z.string().nullable().optional(),
})

export const gewerbePostDeleteSchema = z.object({
  postId: uuid,
})

export const gewerbeAbonnierenSchema = z.object({
  gewerbeId: uuid,
})

// ── Vereine ───────────────────────────────────────────────────────────────────

export const vereinProfilErstellenSchema = z.object({
  verein_name: z.string().min(1).max(200),
  kategorie_id: z.string().uuid().nullable().optional(),
  beschreibung: z.string().max(2000).nullable().optional(),
  website: z.union([z.url(), z.literal(''), z.null()]).optional(),
  logo_url: z.union([z.url(), z.null()]).optional(),
})

export const vereinProfilAktualisierenSchema = z.object({
  vereinId: uuid,
  verein_name: z.string().min(1).max(200),
  kategorie_id: z.string().uuid().nullable().optional(),
  beschreibung: z.string().max(2000).nullable().optional(),
  website: z.union([z.url(), z.literal(''), z.null()]).optional(),
  logo_url: z.union([z.url(), z.null()]).optional(),
})

export const vereinPostSchema = z.object({
  vereinId: uuid,
  titel: z.string().min(1).max(200),
  inhalt: z.string().min(1).max(10000),
  tag: z.enum(['nachricht', 'veranstaltung', 'bekanntmachung']).optional(),
  bildUrl: z.string().nullable().optional(),
  bilderUrls: z.array(z.string()).optional(),
  publishAt: z.string().nullable().optional(),
  veranstaltungDatum: z.string().nullable().optional(),
  veranstaltungOrt: z.string().nullable().optional(),
})

export const vereinPostUpdateSchema = z.object({
  postId: uuid,
  titel: z.string().min(1).max(200),
  inhalt: z.string().min(1).max(10000),
  tag: z.enum(['nachricht', 'veranstaltung', 'bekanntmachung']).optional(),
  bildUrl: z.string().nullable().optional(),
  bilderUrls: z.array(z.string()).optional(),
  publishAt: z.string().nullable().optional(),
  veranstaltungDatum: z.string().nullable().optional(),
  veranstaltungOrt: z.string().nullable().optional(),
})

export const vereinPostDeleteSchema = z.object({
  postId: uuid,
})

export const vereinAbonnierenSchema = z.object({
  vereinId: uuid,
})

// ── Abfallkalender ────────────────────────────────────────────────────────────

export const abfallPraeferenzenSchema = z.object({
  ausgewaehlteTypen: z.array(z.string()).default([]),
  pushAktiviert: z.boolean().default(true),
  emailAktiviert: z.boolean().default(false),
  benachrichtigungUhrzeit: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Ungültiges Uhrzeitformat (HH:MM)')
    .default('18:00'),
})

export const abfallImportSchema = z.object({
  gemeindeId: uuid,
})
