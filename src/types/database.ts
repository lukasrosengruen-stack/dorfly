/**
 * Convenience-Typen für die App
 *
 * Diese Typen werden direkt aus der zentralen Database-Definition abgeleitet.
 * Nie manuell anpassen – stattdessen supabase.ts aktualisieren.
 */

import type { Row } from './supabase'

// ── Re-Export der Enum-Typen ──────────────────────────────────────────────────
export type { UserRole, OrgType, PostChannel, PostStatus, MaengelStatus, FrageStatus, FrageTyp } from './supabase'
export type Gewerbetreibender      = Organisation & { typ: 'gewerbe' }
export type OrganisationMitBranche = Organisation & {
  gewerbe_branchen: Pick<Gewerbebranche, 'id' | 'name'> | null
}

// ── Basis-Tabellen-Typen (nur DB-Felder, keine Joins) ─────────────────────────
export type Gemeinde            = Row<'gemeinden'>
export type Profile             = Row<'profiles'>
export type Organisation        = Row<'organisationen'>
export type Gewerbebranche      = Row<'gewerbe_branchen'>
export type GewerbeAbonnement   = Row<'gewerbe_abonnements'>
export type Post                = Row<'posts'>
export type Mangel              = Row<'maengel'>
export type Frage               = Row<'fragen'>
export type GemeinderatFrage    = Row<'gemeinderat_fragen'>
export type Umfrage             = Row<'umfragen'>
export type UmfrageFrage        = Row<'umfrage_fragen'>
export type UmfrageOption       = Row<'umfrage_optionen'>
export type UmfrageAntwort      = Row<'umfrage_antworten'>
export type UmfrageTeilnahme    = Row<'umfrage_teilnahmen'>

// ── Join-Typen (für Supabase-Queries mit .select('*, profiles(...)')) ─────────
// Diese Typen werden verwendet wenn Supabase mehrere Tabellen zusammen lädt.

export type PostMitProfil = Post & {
  profiles?: (Pick<Profile, 'display_name' | 'avatar_url' | 'role'> & {
    verein_name?: string | null
  }) | null
  organisationen?: Pick<Organisation, 'name' | 'typ' | 'logo_url'> | null
}

export type MangelMitProfil = Mangel & {
  profiles?: Pick<Profile, 'display_name'> | null
}

export type FrageMitProfil = Frage & {
  profiles?: Pick<Profile, 'display_name' | 'avatar_url'> | null
}

export type GemeinderatFrageMitProfil = GemeinderatFrage & {
  fragesteller?: Pick<Profile, 'display_name'> | null
}
