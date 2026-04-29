/**
 * Umfrage-spezifische Typen
 *
 * Basis-Typen werden aus database.ts abgeleitet.
 * Hier nur noch Join-Typen (mit verschachtelten Daten) und Input-/Ergebnis-Typen.
 */

import type { Row } from './supabase'

// ── Re-Export für einfachen Zugriff ──────────────────────────────────────────
export type { FrageTyp } from './supabase'

// ── Umfrage mit verschachtelten Daten (kommt von Supabase-Joins) ──────────────

export type UmfrageOption = Row<'umfrage_optionen'>

export type UmfrageFrage = Row<'umfrage_fragen'> & {
  umfrage_optionen?: UmfrageOption[]
}

export type Umfrage = Row<'umfragen'> & {
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
  typ: Row<'umfrage_fragen'>['typ']
  gesamt_antworten: number
  optionen: {
    label: string
    anzahl: number
    prozent: number
    option_id?: string
  }[]
  durchschnitt?: number // nur für bewertung
}
