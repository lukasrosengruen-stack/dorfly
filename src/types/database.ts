/**
 * Convenience-Typen für die App
 *
 * Diese Typen werden direkt aus der zentralen Database-Definition abgeleitet.
 * Nie manuell anpassen – stattdessen supabase.ts aktualisieren.
 */

import type { Tables, Enums } from './supabase'

// ── Enum-Typen ────────────────────────────────────────────────────────────────
export type UserRole     = Enums<'user_role'>
export type OrgType      = Enums<'org_type'>
export type PostChannel  = Enums<'post_channel'>
export type PostStatus   = Enums<'post_status'>
export type MaengelStatus = Enums<'maengel_status'>
export type FrageStatus  = Enums<'frage_status'>
export type Gewerbetreibender      = Organisation & { typ: 'gewerbe' }
export type OrganisationMitBranche = Organisation & {
  gewerbe_branchen: Pick<Gewerbebranche, 'id' | 'name'> | null
}
export type VereinMitKategorie = Verein & {
  verein_kategorien: Pick<VereinKategorie, 'id' | 'name'> | null
}

// ── Basis-Tabellen-Typen (nur DB-Felder, keine Joins) ─────────────────────────
export type Gemeinde            = Tables<'gemeinden'>
export type Profile             = Tables<'profiles'>
export type Organisation        = Tables<'organisationen'>
export type Gewerbebranche      = Tables<'gewerbe_branchen'>
export type GewerbeAbonnement   = Tables<'gewerbe_abonnements'>
export type Post                = Tables<'posts'>
export type Mangel              = Tables<'maengel'>
export type Frage               = Tables<'fragen'>
export type GemeinderatFrage    = Tables<'gemeinderat_fragen'>
export type Umfrage             = Tables<'umfragen'>
export type UmfrageFrage        = Tables<'umfrage_fragen'>
export type UmfrageOption       = Tables<'umfrage_optionen'>
export type UmfrageAntwort      = Tables<'umfrage_antworten'>
export type UmfrageTeilnahme    = Tables<'umfrage_teilnahmen'>
export type Verein              = Tables<'vereine'>
export type VereinKategorie     = Tables<'verein_kategorien'>
export type VereinAbonnement    = Tables<'verein_abonnements'>

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

// ── Abfallkalender ────────────────────────────────────────────────────────────
export type Abfalltermin              = Tables<'abfalltermine'>
export type AbfallkalenderEinstellung = Tables<'abfallkalender_einstellungen'>
export type AbfallkalenderPraeferenz  = Tables<'abfallkalender_praeferenzen'>

// ── Rollenverwaltung ──────────────────────────────────────────────────────────
export type Einladung    = Tables<'einladungen'>
export type RollenLog    = Tables<'rollen_log'>

export type EinladungRolle  = 'buerger' | 'verein' | 'organisation' | 'gewerbe' | 'gemeinderat'
export type EinladungStatus = 'offen' | 'angenommen' | 'abgelaufen' | 'widerrufen'

export type EinladungMitEinlader = Einladung & {
  profiles?: Pick<Profile, 'display_name'> | null
}
