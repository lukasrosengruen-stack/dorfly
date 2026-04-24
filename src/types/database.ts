export type UserRole = 'buerger' | 'verein' | 'organisation' | 'verwaltung' | 'super_admin'
export type OrgType = 'verein' | 'gewerbe' | 'institution'
export type PostChannel = 'gemeinde' | 'verein' | 'gewerbe'
export type PostStatus = 'pending' | 'published' | 'rejected'
export type MaengelStatus = 'offen' | 'in_bearbeitung' | 'erledigt'
export type FrageStatus = 'offen' | 'beantwortet' | 'archiviert'

export interface Gemeinde {
  id: string
  name: string
  bundesland: string
  einwohner: number | null
  haushalte: number | null
  plz: string | null
  slug: string
  logo_url: string | null
  created_at: string
}

export interface Profile {
  id: string
  gemeinde_id: string | null
  phone: string
  display_name: string | null
  role: UserRole
  avatar_url: string | null
  phone_verified: boolean
  verein_name: string | null
  feed_einstellungen: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface Organisation {
  id: string
  gemeinde_id: string
  profile_id: string
  name: string
  typ: OrgType
  beschreibung: string | null
  logo_url: string | null
  website: string | null
  verified: boolean
  created_at: string
}

export interface Post {
  id: string
  gemeinde_id: string
  author_id: string
  org_id: string | null
  channel: PostChannel
  status: PostStatus
  titel: string
  inhalt: string
  bild_url: string | null
  pinned: boolean
  tag: string | null
  veranstaltung_datum: string | null
  published_at: string
  created_at: string
  // Joins
  profiles?: Pick<Profile, 'display_name' | 'avatar_url' | 'role'> & { verein_name?: string | null }
  organisationen?: Pick<Organisation, 'name' | 'typ' | 'logo_url'>
}

export interface Mangel {
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
  profiles?: Pick<Profile, 'display_name'>
}

export interface Frage {
  id: string
  gemeinde_id: string
  fragesteller_id: string
  frage: string
  antwort: string | null
  oeffentlich: boolean
  status: FrageStatus
  beantwortet_at: string | null
  created_at: string
  profiles?: Pick<Profile, 'display_name' | 'avatar_url'>
}

export interface SmsVerification {
  id: string
  phone: string
  code: string
  expires_at: string
  used: boolean
  created_at: string
}

// Full Supabase Database type
export type Database = {
  public: {
    Tables: {
      gemeinden: {
        Row: Gemeinde
        Insert: Omit<Gemeinde, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Gemeinde>
        Relationships: []
      }
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }
        Update: Partial<Profile>
        Relationships: []
      }
      organisationen: {
        Row: Organisation
        Insert: Omit<Organisation, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Organisation>
        Relationships: []
      }
      posts: {
        Row: Post
        Insert: Omit<Post, 'id' | 'created_at' | 'published_at' | 'profiles' | 'organisationen'> & { id?: string; created_at?: string; published_at?: string }
        Update: Partial<Omit<Post, 'profiles' | 'organisationen'>>
        Relationships: []
      }
      maengel: {
        Row: Mangel
        Insert: Omit<Mangel, 'id' | 'created_at' | 'updated_at' | 'profiles'> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<Omit<Mangel, 'profiles'>>
        Relationships: []
      }
      fragen: {
        Row: Frage
        Insert: Omit<Frage, 'id' | 'created_at' | 'profiles'> & { id?: string; created_at?: string }
        Update: Partial<Omit<Frage, 'profiles'>>
        Relationships: []
      }
      sms_verifications: {
        Row: SmsVerification
        Insert: Omit<SmsVerification, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<SmsVerification>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      user_role: UserRole
      org_type: OrgType
      post_channel: PostChannel
      maengel_status: MaengelStatus
      frage_status: FrageStatus
    }
    CompositeTypes: Record<string, never>
  }
}
