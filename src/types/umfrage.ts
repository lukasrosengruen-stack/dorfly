/**
 * Umfrage-spezifische Typen
 *
 * Basis-Typen werden aus database.ts abgeleitet.
 * Hier nur noch Join-Typen (mit verschachtelten Daten) und Input-/Ergebnis-Typen.
 */

import type { Tables } from './supabase'

// ── Lokaler Typ: Fragetyp (DB-Check-Constraint auf umfrage_fragen.typ) ────────
export type FrageTyp = 'ja_nein' | 'einzelauswahl' | 'mehrfachauswahl' | 'bewertung'

// ── Umfrage mit verschachtelten Daten (kommt von Supabase-Joins) ──────────────

export type UmfrageOption = Tables<'umfrage_optionen'>

export type UmfrageFrage = Tables<'umfrage_fragen'> & {
  umfrage_optionen?: UmfrageOption[]
}

export type Umfrage = Tables<'umfragen'> & {
  umfrage_fragen?: UmfrageFrage[]
}

// ── Input-Typ für Abstimmung (wird beim Absenden genutzt, kein DB-Row) ────────

export interface UmfrageAntwortInput {
  frage_id: string
  antwort_text?: string
  option_id?: string
}

/** @deprecated Bitte UmfrageAntwortInput verwenden */
export type UmfrageAntwort = UmfrageAntwortInput

// ── Ergebnis-Typ für Auswertungsanzeige ───────────────────────────────────────

export interface FrageErgebnis {
  frage_id: string
  frage_text: string
  typ: Tables<'umfrage_fragen'>['typ']
  gesamt_antworten: number
  optionen: {
    label: string
    anzahl: number
    prozent: number
    option_id?: string
  }[]
  durchschnitt?: number // nur für bewertung
}
