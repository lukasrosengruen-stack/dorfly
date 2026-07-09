export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      abfallkalender_einstellungen: {
        Row: {
          aktualisiert_am: string
          erstellt_am: string
          gemeinde_id: string
          importiert_am: string | null
          importiert_von: string | null
          verfuegbare_typen: string[]
        }
        Insert: {
          aktualisiert_am?: string
          erstellt_am?: string
          gemeinde_id: string
          importiert_am?: string | null
          importiert_von?: string | null
          verfuegbare_typen?: string[]
        }
        Update: {
          aktualisiert_am?: string
          erstellt_am?: string
          gemeinde_id?: string
          importiert_am?: string | null
          importiert_von?: string | null
          verfuegbare_typen?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "abfallkalender_einstellungen_gemeinde_id_fkey"
            columns: ["gemeinde_id"]
            isOneToOne: true
            referencedRelation: "gemeinden"
            referencedColumns: ["id"]
          },
        ]
      }
      abfallkalender_praeferenzen: {
        Row: {
          aktualisiert_am: string
          ausgewaehlte_typen: string[]
          benachrichtigung_uhrzeit: string
          email_aktiviert: boolean
          erstellt_am: string
          gemeinde_id: string
          id: string
          push_aktiviert: boolean
          user_id: string
        }
        Insert: {
          aktualisiert_am?: string
          ausgewaehlte_typen?: string[]
          benachrichtigung_uhrzeit?: string
          email_aktiviert?: boolean
          erstellt_am?: string
          gemeinde_id: string
          id?: string
          push_aktiviert?: boolean
          user_id: string
        }
        Update: {
          aktualisiert_am?: string
          ausgewaehlte_typen?: string[]
          benachrichtigung_uhrzeit?: string
          email_aktiviert?: boolean
          erstellt_am?: string
          gemeinde_id?: string
          id?: string
          push_aktiviert?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "abfallkalender_praeferenzen_gemeinde_id_fkey"
            columns: ["gemeinde_id"]
            isOneToOne: false
            referencedRelation: "gemeinden"
            referencedColumns: ["id"]
          },
        ]
      }
      abfalltermine: {
        Row: {
          created_at: string
          datum: string
          gemeinde_id: string
          id: string
          typ: string
        }
        Insert: {
          created_at?: string
          datum: string
          gemeinde_id: string
          id?: string
          typ: string
        }
        Update: {
          created_at?: string
          datum?: string
          gemeinde_id?: string
          id?: string
          typ?: string
        }
        Relationships: [
          {
            foreignKeyName: "abfalltermine_gemeinde_id_fkey"
            columns: ["gemeinde_id"]
            isOneToOne: false
            referencedRelation: "gemeinden"
            referencedColumns: ["id"]
          },
        ]
      }
      einladungen: {
        Row: {
          ablauft_am: string
          angenommen_am: string | null
          eingeladen_von: string
          email: string
          erstellt_am: string
          gemeinde_id: string
          hinweis: string | null
          id: string
          org_id: string | null
          organisation_name: string | null
          rolle: string
          status: string
          token: string
          verein_id: string | null
        }
        Insert: {
          ablauft_am?: string
          angenommen_am?: string | null
          eingeladen_von: string
          email: string
          erstellt_am?: string
          gemeinde_id: string
          hinweis?: string | null
          id?: string
          org_id?: string | null
          organisation_name?: string | null
          rolle: string
          status?: string
          token?: string
          verein_id?: string | null
        }
        Update: {
          ablauft_am?: string
          angenommen_am?: string | null
          eingeladen_von?: string
          email?: string
          erstellt_am?: string
          gemeinde_id?: string
          hinweis?: string | null
          id?: string
          org_id?: string | null
          organisation_name?: string | null
          rolle?: string
          status?: string
          token?: string
          verein_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "einladungen_eingeladen_von_fkey"
            columns: ["eingeladen_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "einladungen_eingeladen_von_fkey"
            columns: ["eingeladen_von"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "einladungen_gemeinde_id_fkey"
            columns: ["gemeinde_id"]
            isOneToOne: false
            referencedRelation: "gemeinden"
            referencedColumns: ["id"]
          },
        ]
      }
      fragen: {
        Row: {
          antwort: string | null
          beantwortet_at: string | null
          created_at: string | null
          frage: string
          fragesteller_id: string
          gemeinde_id: string
          id: string
          oeffentlich: boolean | null
          status: Database["public"]["Enums"]["frage_status"] | null
        }
        Insert: {
          antwort?: string | null
          beantwortet_at?: string | null
          created_at?: string | null
          frage: string
          fragesteller_id: string
          gemeinde_id: string
          id?: string
          oeffentlich?: boolean | null
          status?: Database["public"]["Enums"]["frage_status"] | null
        }
        Update: {
          antwort?: string | null
          beantwortet_at?: string | null
          created_at?: string | null
          frage?: string
          fragesteller_id?: string
          gemeinde_id?: string
          id?: string
          oeffentlich?: boolean | null
          status?: Database["public"]["Enums"]["frage_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "fragen_fragesteller_id_fkey"
            columns: ["fragesteller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fragen_fragesteller_id_fkey"
            columns: ["fragesteller_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fragen_gemeinde_id_fkey"
            columns: ["gemeinde_id"]
            isOneToOne: false
            referencedRelation: "gemeinden"
            referencedColumns: ["id"]
          },
        ]
      }
      gemeinden: {
        Row: {
          bundesland: string
          created_at: string | null
          einwohner: number | null
          features: Json
          haushalte: number | null
          homepage_url: string | null
          id: string
          logo_url: string | null
          mitteilungsblatt_url: string | null
          name: string
          notfallnummern_url: string | null
          plz: string | null
          primary_color: string | null
          ratsinformation_url: string | null
          slug: string
          warncell_id: string | null
        }
        Insert: {
          bundesland: string
          created_at?: string | null
          einwohner?: number | null
          features?: Json
          haushalte?: number | null
          homepage_url?: string | null
          id?: string
          logo_url?: string | null
          mitteilungsblatt_url?: string | null
          name: string
          notfallnummern_url?: string | null
          plz?: string | null
          primary_color?: string | null
          ratsinformation_url?: string | null
          slug: string
          warncell_id?: string | null
        }
        Update: {
          bundesland?: string
          created_at?: string | null
          einwohner?: number | null
          features?: Json
          haushalte?: number | null
          homepage_url?: string | null
          id?: string
          logo_url?: string | null
          mitteilungsblatt_url?: string | null
          name?: string
          notfallnummern_url?: string | null
          plz?: string | null
          primary_color?: string | null
          ratsinformation_url?: string | null
          slug?: string
          warncell_id?: string | null
        }
        Relationships: []
      }
      gemeinderat_fragen: {
        Row: {
          antwort: string | null
          created_at: string
          frage: string
          fragesteller_id: string
          gemeinde_id: string
          gemeinderat_id: string
          id: string
          status: string
        }
        Insert: {
          antwort?: string | null
          created_at?: string
          frage: string
          fragesteller_id: string
          gemeinde_id: string
          gemeinderat_id: string
          id?: string
          status?: string
        }
        Update: {
          antwort?: string | null
          created_at?: string
          frage?: string
          fragesteller_id?: string
          gemeinde_id?: string
          gemeinderat_id?: string
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "gemeinderat_fragen_fragesteller_id_fkey"
            columns: ["fragesteller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gemeinderat_fragen_fragesteller_id_fkey"
            columns: ["fragesteller_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gemeinderat_fragen_gemeinde_id_fkey"
            columns: ["gemeinde_id"]
            isOneToOne: false
            referencedRelation: "gemeinden"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gemeinderat_fragen_gemeinderat_id_fkey"
            columns: ["gemeinderat_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gemeinderat_fragen_gemeinderat_id_fkey"
            columns: ["gemeinderat_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      gewerbe_abonnements: {
        Row: {
          created_at: string | null
          gewerbe_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          gewerbe_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          gewerbe_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gewerbe_abonnements_gewerbe_id_fkey"
            columns: ["gewerbe_id"]
            isOneToOne: false
            referencedRelation: "organisationen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gewerbe_abonnements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gewerbe_abonnements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
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
      maengel: {
        Row: {
          adresse: string | null
          beschreibung: string | null
          created_at: string | null
          foto_url: string | null
          gemeinde_id: string
          id: string
          lat: number | null
          lng: number | null
          melder_id: string
          notiz_intern: string | null
          status: Database["public"]["Enums"]["maengel_status"] | null
          titel: string
          updated_at: string | null
        }
        Insert: {
          adresse?: string | null
          beschreibung?: string | null
          created_at?: string | null
          foto_url?: string | null
          gemeinde_id: string
          id?: string
          lat?: number | null
          lng?: number | null
          melder_id: string
          notiz_intern?: string | null
          status?: Database["public"]["Enums"]["maengel_status"] | null
          titel: string
          updated_at?: string | null
        }
        Update: {
          adresse?: string | null
          beschreibung?: string | null
          created_at?: string | null
          foto_url?: string | null
          gemeinde_id?: string
          id?: string
          lat?: number | null
          lng?: number | null
          melder_id?: string
          notiz_intern?: string | null
          status?: Database["public"]["Enums"]["maengel_status"] | null
          titel?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maengel_gemeinde_id_fkey"
            columns: ["gemeinde_id"]
            isOneToOne: false
            referencedRelation: "gemeinden"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maengel_melder_id_fkey"
            columns: ["melder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maengel_melder_id_fkey"
            columns: ["melder_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      meldungen: {
        Row: {
          beschreibung: string | null
          created_at: string
          gemeinde_id: string
          grund: string
          id: string
          inhalt_id: string
          inhalt_typ: string
          melder_id: string
          status: string
        }
        Insert: {
          beschreibung?: string | null
          created_at?: string
          gemeinde_id: string
          grund: string
          id?: string
          inhalt_id: string
          inhalt_typ: string
          melder_id: string
          status?: string
        }
        Update: {
          beschreibung?: string | null
          created_at?: string
          gemeinde_id?: string
          grund?: string
          id?: string
          inhalt_id?: string
          inhalt_typ?: string
          melder_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "meldungen_gemeinde_id_fkey"
            columns: ["gemeinde_id"]
            isOneToOne: false
            referencedRelation: "gemeinden"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          confirmation_token: string
          confirmed_at: string | null
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          municipality: string | null
          status: string
        }
        Insert: {
          confirmation_token?: string
          confirmed_at?: string | null
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name: string
          municipality?: string | null
          status?: string
        }
        Update: {
          confirmation_token?: string
          confirmed_at?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          municipality?: string | null
          status?: string
        }
        Relationships: []
      }
      organisationen: {
        Row: {
          adresse: string | null
          beschreibung: string | null
          branche_id: string | null
          created_at: string | null
          gemeinde_id: string
          id: string
          logo_url: string | null
          name: string
          oeffnungszeiten: string | null
          plan: string
          profile_id: string
          typ: Database["public"]["Enums"]["org_type"]
          verified: boolean | null
          website: string | null
        }
        Insert: {
          adresse?: string | null
          beschreibung?: string | null
          branche_id?: string | null
          created_at?: string | null
          gemeinde_id: string
          id?: string
          logo_url?: string | null
          name: string
          oeffnungszeiten?: string | null
          plan?: string
          profile_id: string
          typ: Database["public"]["Enums"]["org_type"]
          verified?: boolean | null
          website?: string | null
        }
        Update: {
          adresse?: string | null
          beschreibung?: string | null
          branche_id?: string | null
          created_at?: string | null
          gemeinde_id?: string
          id?: string
          logo_url?: string | null
          name?: string
          oeffnungszeiten?: string | null
          plan?: string
          profile_id?: string
          typ?: Database["public"]["Enums"]["org_type"]
          verified?: boolean | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organisationen_branche_id_fkey"
            columns: ["branche_id"]
            isOneToOne: false
            referencedRelation: "gewerbe_branchen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organisationen_gemeinde_id_fkey"
            columns: ["gemeinde_id"]
            isOneToOne: false
            referencedRelation: "gemeinden"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organisationen_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organisationen_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string | null
          bild_url: string | null
          bilder_urls: string[] | null
          channel: Database["public"]["Enums"]["post_channel"]
          created_at: string | null
          dwd_id: string | null
          expires_at: string | null
          gemeinde_id: string
          id: string
          inhalt: string
          is_active: boolean
          org_id: string | null
          pinned: boolean | null
          publish_at: string | null
          published_at: string | null
          rejection_reason: string | null
          severity: number | null
          sichtbarkeit: string | null
          status: Database["public"]["Enums"]["post_status"]
          tag: string | null
          titel: string
          veranstaltung_datum: string | null
          veranstaltung_ort: string | null
        }
        Insert: {
          author_id?: string | null
          bild_url?: string | null
          bilder_urls?: string[] | null
          channel: Database["public"]["Enums"]["post_channel"]
          created_at?: string | null
          dwd_id?: string | null
          expires_at?: string | null
          gemeinde_id: string
          id?: string
          inhalt: string
          is_active?: boolean
          org_id?: string | null
          pinned?: boolean | null
          publish_at?: string | null
          published_at?: string | null
          rejection_reason?: string | null
          severity?: number | null
          sichtbarkeit?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          tag?: string | null
          titel: string
          veranstaltung_datum?: string | null
          veranstaltung_ort?: string | null
        }
        Update: {
          author_id?: string | null
          bild_url?: string | null
          bilder_urls?: string[] | null
          channel?: Database["public"]["Enums"]["post_channel"]
          created_at?: string | null
          dwd_id?: string | null
          expires_at?: string | null
          gemeinde_id?: string
          id?: string
          inhalt?: string
          is_active?: boolean
          org_id?: string | null
          pinned?: boolean | null
          publish_at?: string | null
          published_at?: string | null
          rejection_reason?: string | null
          severity?: number | null
          sichtbarkeit?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          tag?: string | null
          titel?: string
          veranstaltung_datum?: string | null
          veranstaltung_ort?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_gemeinde_id_fkey"
            columns: ["gemeinde_id"]
            isOneToOne: false
            referencedRelation: "gemeinden"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          fraktion: string | null
          gemeinde_id: string | null
          id: string
          kontakt_email: string | null
          phone: string | null
          phone_verified: boolean | null
          role: Database["public"]["Enums"]["user_role"]
          social_facebook: string | null
          social_instagram: string | null
          social_tiktok: string | null
          social_x: string | null
          ueber_mich: string | null
          updated_at: string | null
          verein_name: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          fraktion?: string | null
          gemeinde_id?: string | null
          id: string
          kontakt_email?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          role?: Database["public"]["Enums"]["user_role"]
          social_facebook?: string | null
          social_instagram?: string | null
          social_tiktok?: string | null
          social_x?: string | null
          ueber_mich?: string | null
          updated_at?: string | null
          verein_name?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          fraktion?: string | null
          gemeinde_id?: string | null
          id?: string
          kontakt_email?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          role?: Database["public"]["Enums"]["user_role"]
          social_facebook?: string | null
          social_instagram?: string | null
          social_tiktok?: string | null
          social_x?: string | null
          ueber_mich?: string | null
          updated_at?: string | null
          verein_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_gemeinde_id_fkey"
            columns: ["gemeinde_id"]
            isOneToOne: false
            referencedRelation: "gemeinden"
            referencedColumns: ["id"]
          },
        ]
      }
      rollen_log: {
        Row: {
          aktion: string
          alte_rolle: string | null
          ausgefuehrt_von: string
          einladung_id: string | null
          erstellt_am: string
          gemeinde_id: string
          id: string
          neue_rolle: string | null
          ziel_email: string
          ziel_profile_id: string | null
        }
        Insert: {
          aktion: string
          alte_rolle?: string | null
          ausgefuehrt_von: string
          einladung_id?: string | null
          erstellt_am?: string
          gemeinde_id: string
          id?: string
          neue_rolle?: string | null
          ziel_email: string
          ziel_profile_id?: string | null
        }
        Update: {
          aktion?: string
          alte_rolle?: string | null
          ausgefuehrt_von?: string
          einladung_id?: string | null
          erstellt_am?: string
          gemeinde_id?: string
          id?: string
          neue_rolle?: string | null
          ziel_email?: string
          ziel_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rollen_log_gemeinde_id_fkey"
            columns: ["gemeinde_id"]
            isOneToOne: false
            referencedRelation: "gemeinden"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_verifications: {
        Row: {
          code: string
          created_at: string | null
          expires_at: string
          id: string
          phone: string
          used: boolean | null
        }
        Insert: {
          code: string
          created_at?: string | null
          expires_at: string
          id?: string
          phone: string
          used?: boolean | null
        }
        Update: {
          code?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          phone?: string
          used?: boolean | null
        }
        Relationships: []
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      umfrage_antworten: {
        Row: {
          antwort_text: string | null
          created_at: string
          frage_id: string
          id: string
          option_id: string | null
          umfrage_id: string
          user_id: string
        }
        Insert: {
          antwort_text?: string | null
          created_at?: string
          frage_id: string
          id?: string
          option_id?: string | null
          umfrage_id: string
          user_id: string
        }
        Update: {
          antwort_text?: string | null
          created_at?: string
          frage_id?: string
          id?: string
          option_id?: string | null
          umfrage_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "umfrage_antworten_frage_id_fkey"
            columns: ["frage_id"]
            isOneToOne: false
            referencedRelation: "umfrage_fragen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umfrage_antworten_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "umfrage_optionen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umfrage_antworten_umfrage_id_fkey"
            columns: ["umfrage_id"]
            isOneToOne: false
            referencedRelation: "umfragen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umfrage_antworten_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umfrage_antworten_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      umfrage_fragen: {
        Row: {
          bilder_urls: string[]
          frage_text: string
          id: string
          reihenfolge: number
          typ: string
          umfrage_id: string
        }
        Insert: {
          bilder_urls?: string[]
          frage_text: string
          id?: string
          reihenfolge?: number
          typ: string
          umfrage_id: string
        }
        Update: {
          bilder_urls?: string[]
          frage_text?: string
          id?: string
          reihenfolge?: number
          typ?: string
          umfrage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "umfrage_fragen_umfrage_id_fkey"
            columns: ["umfrage_id"]
            isOneToOne: false
            referencedRelation: "umfragen"
            referencedColumns: ["id"]
          },
        ]
      }
      umfrage_optionen: {
        Row: {
          frage_id: string
          id: string
          option_text: string
          reihenfolge: number
        }
        Insert: {
          frage_id: string
          id?: string
          option_text: string
          reihenfolge?: number
        }
        Update: {
          frage_id?: string
          id?: string
          option_text?: string
          reihenfolge?: number
        }
        Relationships: [
          {
            foreignKeyName: "umfrage_optionen_frage_id_fkey"
            columns: ["frage_id"]
            isOneToOne: false
            referencedRelation: "umfrage_fragen"
            referencedColumns: ["id"]
          },
        ]
      }
      umfrage_teilnahmen: {
        Row: {
          created_at: string
          id: string
          umfrage_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          umfrage_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          umfrage_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "umfrage_teilnahmen_umfrage_id_fkey"
            columns: ["umfrage_id"]
            isOneToOne: false
            referencedRelation: "umfragen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umfrage_teilnahmen_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umfrage_teilnahmen_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      umfragen: {
        Row: {
          author_id: string
          beschreibung: string | null
          bilder_urls: string[]
          created_at: string
          enddatum: string
          gemeinde_id: string
          id: string
          titel: string
        }
        Insert: {
          author_id: string
          beschreibung?: string | null
          bilder_urls?: string[]
          created_at?: string
          enddatum: string
          gemeinde_id: string
          id?: string
          titel: string
        }
        Update: {
          author_id?: string
          beschreibung?: string | null
          bilder_urls?: string[]
          created_at?: string
          enddatum?: string
          gemeinde_id?: string
          id?: string
          titel?: string
        }
        Relationships: [
          {
            foreignKeyName: "umfragen_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umfragen_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umfragen_gemeinde_id_fkey"
            columns: ["gemeinde_id"]
            isOneToOne: false
            referencedRelation: "gemeinden"
            referencedColumns: ["id"]
          },
        ]
      }
      verein_abonnements: {
        Row: {
          created_at: string
          id: string
          user_id: string
          verein_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          verein_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          verein_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verein_abonnements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verein_abonnements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verein_abonnements_verein_id_fkey"
            columns: ["verein_id"]
            isOneToOne: false
            referencedRelation: "vereine"
            referencedColumns: ["id"]
          },
        ]
      }
      verein_kategorien: {
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
      vereine: {
        Row: {
          beschreibung: string | null
          created_at: string
          gemeinde_id: string
          id: string
          kategorie_id: string | null
          logo_url: string | null
          profile_id: string
          typ: string
          verein_name: string
          verified: boolean
          website: string | null
        }
        Insert: {
          beschreibung?: string | null
          created_at?: string
          gemeinde_id: string
          id?: string
          kategorie_id?: string | null
          logo_url?: string | null
          profile_id: string
          typ: string
          verein_name: string
          verified?: boolean
          website?: string | null
        }
        Update: {
          beschreibung?: string | null
          created_at?: string
          gemeinde_id?: string
          id?: string
          kategorie_id?: string | null
          logo_url?: string | null
          profile_id?: string
          typ?: string
          verein_name?: string
          verified?: boolean
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vereine_gemeinde_id_fkey"
            columns: ["gemeinde_id"]
            isOneToOne: false
            referencedRelation: "gemeinden"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vereine_kategorie_id_fkey"
            columns: ["kategorie_id"]
            isOneToOne: false
            referencedRelation: "verein_kategorien"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vereine_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vereine_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      profiles_public: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          fraktion: string | null
          gemeinde_id: string | null
          id: string | null
          kontakt_email: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          social_facebook: string | null
          social_instagram: string | null
          social_tiktok: string | null
          social_x: string | null
          ueber_mich: string | null
          verein_name: string | null
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          fraktion?: string | null
          gemeinde_id?: string | null
          id?: string | null
          kontakt_email?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_tiktok?: string | null
          social_x?: string | null
          ueber_mich?: string | null
          verein_name?: string | null
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          fraktion?: string | null
          gemeinde_id?: string | null
          id?: string | null
          kontakt_email?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_tiktok?: string | null
          social_x?: string | null
          ueber_mich?: string | null
          verein_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_gemeinde_id_fkey"
            columns: ["gemeinde_id"]
            isOneToOne: false
            referencedRelation: "gemeinden"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      current_gemeinde_id: { Args: never; Returns: string }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      einladungen_ablauf_aktualisieren: { Args: never; Returns: undefined }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_einladung_by_token: { Args: { p_token: string }; Returns: Json }
      gettransactionid: { Args: never; Returns: unknown }
      is_verwaltung: { Args: never; Returns: boolean }
      longtransactionsenabled: { Args: never; Returns: boolean }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      superadmin_buerger_stats: {
        Args: { p_gemeinde_id?: string }
        Returns: Json
      }
      superadmin_maengel_stats: {
        Args: { p_gemeinde_id?: string }
        Returns: Json
      }
      superadmin_posts_stats: {
        Args: { p_gemeinde_id?: string }
        Returns: Json
      }
      superadmin_produzentenaccounts: {
        Args: { p_gemeinde_id?: string; p_rolle: string }
        Returns: Json
      }
      superadmin_rollen_stats: {
        Args: { p_gemeinde_id?: string }
        Returns: Json
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      frage_status: "offen" | "beantwortet" | "archiviert"
      maengel_status: "offen" | "in_bearbeitung" | "erledigt"
      org_type: "verein" | "gewerbe" | "institution"
      post_channel:
        | "gemeinde"
        | "verein"
        | "gewerbe"
        | "gemeinderat"
        | "warnung"
      post_status: "pending" | "published" | "rejected"
      user_role:
        | "buerger"
        | "organisation"
        | "verwaltung"
        | "super_admin"
        | "gewerbe"
        | "gemeinderat"
        | "verein"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      frage_status: ["offen", "beantwortet", "archiviert"],
      maengel_status: ["offen", "in_bearbeitung", "erledigt"],
      org_type: ["verein", "gewerbe", "institution"],
      post_channel: ["gemeinde", "verein", "gewerbe", "gemeinderat", "warnung"],
      post_status: ["pending", "published", "rejected"],
      user_role: [
        "buerger",
        "organisation",
        "verwaltung",
        "super_admin",
        "gewerbe",
        "gemeinderat",
        "verein",
      ],
    },
  },
} as const
