/**
 * Supabase Database Types
 *
 * Diese Datei beschreibt die exakte Struktur der Datenbank.
 * Sie kann zukünftig automatisch generiert werden mit:
 *   npm run db:types
 *
 * Dafür wird ein Supabase Access Token benötigt (supabase.com → Account → Access Tokens).
 * Dann in .env.local eintragen: SUPABASE_ACCESS_TOKEN=sbp_xxx
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ── Enum-Typen ────────────────────────────────────────────────────────────────

export type UserRole =
  | 'buerger'
  | 'verein'
  | 'organisation'
  | 'gewerbe'
  | 'gemeinderat'
  | 'verwaltung'
  | 'super_admin'

export type OrgType = 'verein' | 'gewerbe' | 'institution'

export type PostChannel = 'gemeinde' | 'verein' | 'gewerbe' | 'gemeinderat'

export type PostStatus = 'pending' | 'published' | 'rejected'

export type MaengelStatus = 'offen' | 'in_bearbeitung' | 'erledigt'

export type FrageStatus = 'offen' | 'beantwortet' | 'archiviert'

export type FrageTyp =
  | 'ja_nein'
  | 'einzelauswahl'
  | 'mehrfachauswahl'
  | 'bewertung'

// ── Datenbank-Typ (wird für typsichere Supabase-Clients genutzt) ──────────────

export interface Database {
  public: {
    Tables: {
      // ── Gemeinden ──────────────────────────────────────────────────────────
      gemeinden: {
        Row: {
          id: string
          name: string
          bundesland: string
          einwohner: number | null
          haushalte: number | null
          plz: string | null
          slug: string
          logo_url: string | null
          primary_color: string | null
          ratsinformation_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          bundesland: string
          einwohner?: number | null
          haushalte?: number | null
          plz?: string | null
          slug: string
          logo_url?: string | null
          primary_color?: string | null
          ratsinformation_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          bundesland?: string
          einwohner?: number | null
          haushalte?: number | null
          plz?: string | null
          slug?: string
          logo_url?: string | null
          primary_color?: string | null
          ratsinformation_url?: string | null
          created_at?: string
        }
        Relationships: []
      }

      // ── Profile ────────────────────────────────────────────────────────────
      profiles: {
        Row: {
          id: string
          gemeinde_id: string | null
          phone: string
          display_name: string | null
          vorname: string | null
          nachname: string | null
          adresse: string | null
          geburtsdatum: string | null
          role: UserRole
          avatar_url: string | null
          phone_verified: boolean
          verein_name: string | null
          feed_einstellungen: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          gemeinde_id?: string | null
          phone?: string          // optional beim Insert (kann via DB-Default oder später gesetzt werden)
          display_name?: string | null
          vorname?: string | null
          nachname?: string | null
          adresse?: string | null
          geburtsdatum?: string | null
          role?: UserRole
          avatar_url?: string | null
          phone_verified?: boolean
          verein_name?: string | null
          feed_einstellungen?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          gemeinde_id?: string | null
          phone?: string
          display_name?: string | null
          vorname?: string | null
          nachname?: string | null
          adresse?: string | null
          geburtsdatum?: string | null
          role?: UserRole
          avatar_url?: string | null
          phone_verified?: boolean
          verein_name?: string | null
          feed_einstellungen?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_gemeinde_id_fkey'
            columns: ['gemeinde_id']
            referencedRelation: 'gemeinden'
            referencedColumns: ['id']
          },
        ]
      }

      // ── Organisationen ─────────────────────────────────────────────────────
      organisationen: {
        Row: {
          id: string
          gemeinde_id: string
          profile_id: string
          name: string
          typ: OrgType
          beschreibung: string | null
          logo_url: string | null
          website: string | null
          verified: boolean
          branche_id: string | null
          adresse: string | null
          oeffnungszeiten: string | null
          plan: string
          created_at: string
        }
        Insert: {
          id?: string
          gemeinde_id: string
          profile_id: string
          name: string
          typ: OrgType
          beschreibung?: string | null
          logo_url?: string | null
          website?: string | null
          verified?: boolean
          branche_id?: string | null
          adresse?: string | null
          oeffnungszeiten?: string | null
          plan?: string
          created_at?: string
        }
        Update: {
          id?: string
          gemeinde_id?: string
          profile_id?: string
          name?: string
          typ?: OrgType
          beschreibung?: string | null
          logo_url?: string | null
          website?: string | null
          verified?: boolean
          branche_id?: string | null
          adresse?: string | null
          oeffnungszeiten?: string | null
          plan?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'organisationen_gemeinde_id_fkey'
            columns: ['gemeinde_id']
            referencedRelation: 'gemeinden'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'organisationen_profile_id_fkey'
            columns: ['profile_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }

      // ── Gewerbe-Branchen ──────────────────────────────────────────────────
      gewerbe_branchen: {
        Row: {
          id: string
          name: string
          reihenfolge: number
        }
        Insert: {
          id?: string
          name: string
          reihenfolge?: number
        }
        Update: {
          id?: string
          name?: string
          reihenfolge?: number
        }
        Relationships: []
      }

      // ── Gewerbe-Abonnements ────────────────────────────────────────────────
      gewerbe_abonnements: {
        Row: {
          id: string
          user_id: string
          gewerbe_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          gewerbe_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          gewerbe_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'gewerbe_abonnements_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'gewerbe_abonnements_gewerbe_id_fkey'
            columns: ['gewerbe_id']
            referencedRelation: 'organisationen'
            referencedColumns: ['id']
          },
        ]
      }

      // ── Posts ──────────────────────────────────────────────────────────────
      posts: {
        Row: {
          id: string
          gemeinde_id: string
          author_id: string
          org_id: string | null
          channel: PostChannel
          status: PostStatus
          titel: string
          inhalt: string
          bild_url: string | null
          bilder_urls: string[] | null
          pinned: boolean
          tag: string | null
          veranstaltung_datum: string | null
          veranstaltung_ort: string | null
          publish_at: string | null
          published_at: string
          created_at: string
        }
        Insert: {
          id?: string
          gemeinde_id: string
          author_id: string
          org_id?: string | null
          channel: PostChannel
          status?: PostStatus
          titel: string
          inhalt: string
          bild_url?: string | null
          bilder_urls?: string[] | null
          pinned?: boolean
          tag?: string | null
          veranstaltung_datum?: string | null
          veranstaltung_ort?: string | null
          publish_at?: string | null
          published_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          gemeinde_id?: string
          author_id?: string
          org_id?: string | null
          channel?: PostChannel
          status?: PostStatus
          titel?: string
          inhalt?: string
          bild_url?: string | null
          bilder_urls?: string[] | null
          pinned?: boolean
          tag?: string | null
          veranstaltung_datum?: string | null
          veranstaltung_ort?: string | null
          publish_at?: string | null
          published_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'posts_gemeinde_id_fkey'
            columns: ['gemeinde_id']
            referencedRelation: 'gemeinden'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'posts_author_id_fkey'
            columns: ['author_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }

      // ── Mängelmelder ───────────────────────────────────────────────────────
      maengel: {
        Row: {
          id: string
          gemeinde_id: string
          melder_id: string
          titel: string
          beschreibung: string | null
          foto_url: string | null
          lat: number | null
          lng: number | null
          adresse: string | null
          status: MaengelStatus
          notiz_intern: string | null
          nachricht_an_buerger: string | null
          status_updated_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          gemeinde_id: string
          melder_id: string
          titel: string
          beschreibung?: string | null
          foto_url?: string | null
          lat?: number | null
          lng?: number | null
          adresse?: string | null
          status?: MaengelStatus
          notiz_intern?: string | null
          nachricht_an_buerger?: string | null
          status_updated_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          gemeinde_id?: string
          melder_id?: string
          titel?: string
          beschreibung?: string | null
          foto_url?: string | null
          lat?: number | null
          lng?: number | null
          adresse?: string | null
          status?: MaengelStatus
          notiz_intern?: string | null
          nachricht_an_buerger?: string | null
          status_updated_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'maengel_gemeinde_id_fkey'
            columns: ['gemeinde_id']
            referencedRelation: 'gemeinden'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'maengel_melder_id_fkey'
            columns: ['melder_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }

      // ── Frag den Bürgermeister ─────────────────────────────────────────────
      fragen: {
        Row: {
          id: string
          gemeinde_id: string
          fragesteller_id: string
          frage: string
          antwort: string | null
          oeffentlich: boolean
          status: FrageStatus
          beantwortet_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          gemeinde_id: string
          fragesteller_id: string
          frage: string
          antwort?: string | null
          oeffentlich?: boolean
          status?: FrageStatus
          beantwortet_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          gemeinde_id?: string
          fragesteller_id?: string
          frage?: string
          antwort?: string | null
          oeffentlich?: boolean
          status?: FrageStatus
          beantwortet_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'fragen_gemeinde_id_fkey'
            columns: ['gemeinde_id']
            referencedRelation: 'gemeinden'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fragen_fragesteller_id_fkey'
            columns: ['fragesteller_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }

      // ── Gemeinderat-Fragen ─────────────────────────────────────────────────
      gemeinderat_fragen: {
        Row: {
          id: string
          gemeinde_id: string
          fragesteller_id: string
          gemeinderat_id: string
          frage: string
          antwort: string | null
          status: FrageStatus
          created_at: string
        }
        Insert: {
          id?: string
          gemeinde_id: string
          fragesteller_id: string
          gemeinderat_id: string
          frage: string
          antwort?: string | null
          status?: FrageStatus
          created_at?: string
        }
        Update: {
          id?: string
          gemeinde_id?: string
          fragesteller_id?: string
          gemeinderat_id?: string
          frage?: string
          antwort?: string | null
          status?: FrageStatus
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'gemeinderat_fragen_gemeinde_id_fkey'
            columns: ['gemeinde_id']
            referencedRelation: 'gemeinden'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'gemeinderat_fragen_fragesteller_id_fkey'
            columns: ['fragesteller_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'gemeinderat_fragen_gemeinderat_id_fkey'
            columns: ['gemeinderat_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }

      // ── Umfragen ───────────────────────────────────────────────────────────
      umfragen: {
        Row: {
          id: string
          gemeinde_id: string
          author_id: string
          titel: string
          beschreibung: string | null
          enddatum: string
          created_at: string
        }
        Insert: {
          id?: string
          gemeinde_id: string
          author_id: string
          titel: string
          beschreibung?: string | null
          enddatum: string
          created_at?: string
        }
        Update: {
          id?: string
          gemeinde_id?: string
          author_id?: string
          titel?: string
          beschreibung?: string | null
          enddatum?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'umfragen_gemeinde_id_fkey'
            columns: ['gemeinde_id']
            referencedRelation: 'gemeinden'
            referencedColumns: ['id']
          },
        ]
      }

      // ── Umfrage-Fragen ─────────────────────────────────────────────────────
      umfrage_fragen: {
        Row: {
          id: string
          umfrage_id: string
          reihenfolge: number
          frage_text: string
          typ: FrageTyp
        }
        Insert: {
          id?: string
          umfrage_id: string
          reihenfolge: number
          frage_text: string
          typ: FrageTyp
        }
        Update: {
          id?: string
          umfrage_id?: string
          reihenfolge?: number
          frage_text?: string
          typ?: FrageTyp
        }
        Relationships: [
          {
            foreignKeyName: 'umfrage_fragen_umfrage_id_fkey'
            columns: ['umfrage_id']
            referencedRelation: 'umfragen'
            referencedColumns: ['id']
          },
        ]
      }

      // ── Umfrage-Optionen ───────────────────────────────────────────────────
      umfrage_optionen: {
        Row: {
          id: string
          frage_id: string
          reihenfolge: number
          option_text: string
        }
        Insert: {
          id?: string
          frage_id: string
          reihenfolge: number
          option_text: string
        }
        Update: {
          id?: string
          frage_id?: string
          reihenfolge?: number
          option_text?: string
        }
        Relationships: [
          {
            foreignKeyName: 'umfrage_optionen_frage_id_fkey'
            columns: ['frage_id']
            referencedRelation: 'umfrage_fragen'
            referencedColumns: ['id']
          },
        ]
      }

      // ── Umfrage-Antworten ──────────────────────────────────────────────────
      umfrage_antworten: {
        Row: {
          id: string
          umfrage_id: string
          frage_id: string
          user_id: string
          antwort_text: string | null
          option_id: string | null
        }
        Insert: {
          id?: string
          umfrage_id: string
          frage_id: string
          user_id: string
          antwort_text?: string | null
          option_id?: string | null
        }
        Update: {
          id?: string
          umfrage_id?: string
          frage_id?: string
          user_id?: string
          antwort_text?: string | null
          option_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'umfrage_antworten_umfrage_id_fkey'
            columns: ['umfrage_id']
            referencedRelation: 'umfragen'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'umfrage_antworten_frage_id_fkey'
            columns: ['frage_id']
            referencedRelation: 'umfrage_fragen'
            referencedColumns: ['id']
          },
        ]
      }

      // ── Umfrage-Teilnahmen ─────────────────────────────────────────────────
      umfrage_teilnahmen: {
        Row: {
          id: string
          umfrage_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          umfrage_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          umfrage_id?: string
          user_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'umfrage_teilnahmen_umfrage_id_fkey'
            columns: ['umfrage_id']
            referencedRelation: 'umfragen'
            referencedColumns: ['id']
          },
        ]
      }

      // ── SMS-Verifikationen ─────────────────────────────────────────────────
      sms_verifications: {
        Row: {
          id: string
          phone: string
          code: string
          expires_at: string
          used: boolean
          created_at: string
        }
        Insert: {
          id?: string
          phone: string
          code: string
          expires_at: string
          used?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          phone?: string
          code?: string
          expires_at?: string
          used?: boolean
          created_at?: string
        }
        Relationships: []
      }
    }

    Views: Record<string, never>

    Functions: Record<string, never>

    Enums: {
      user_role: UserRole
      org_type: OrgType
      post_channel: PostChannel
      post_status: PostStatus
      maengel_status: MaengelStatus
      frage_status: FrageStatus
      frage_typ: FrageTyp
      gewerbe_plan: 'standard' | 'premium'
    }

    CompositeTypes: Record<string, never>
  }
}

// ── Hilfs-Typen für einfacheren Zugriff ──────────────────────────────────────

/** Alle Tabellennamen der Datenbank */
export type TableName = keyof Database['public']['Tables']

/** Row-Typ einer beliebigen Tabelle */
export type Row<T extends TableName> = Database['public']['Tables'][T]['Row']

/** Insert-Typ einer beliebigen Tabelle */
export type Insert<T extends TableName> = Database['public']['Tables'][T]['Insert']

/** Update-Typ einer beliebigen Tabelle */
export type Update<T extends TableName> = Database['public']['Tables'][T]['Update']
