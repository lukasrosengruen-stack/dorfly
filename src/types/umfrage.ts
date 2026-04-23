export type FrageTyp = 'ja_nein' | 'einzelauswahl' | 'mehrfachauswahl' | 'bewertung'

export interface UmfrageOption {
  id: string
  frage_id: string
  reihenfolge: number
  option_text: string
}

export interface UmfrageFrage {
  id: string
  umfrage_id: string
  reihenfolge: number
  frage_text: string
  typ: FrageTyp
  umfrage_optionen?: UmfrageOption[]
}

export interface Umfrage {
  id: string
  gemeinde_id: string
  author_id: string
  titel: string
  beschreibung: string | null
  enddatum: string
  created_at: string
  umfrage_fragen?: UmfrageFrage[]
}

export interface UmfrageAntwort {
  frage_id: string
  antwort_text?: string
  option_id?: string
}

// Für die Ergebnisanzeige
export interface FrageErgebnis {
  frage_id: string
  frage_text: string
  typ: FrageTyp
  gesamt_antworten: number
  optionen: {
    label: string
    anzahl: number
    prozent: number
    option_id?: string
  }[]
  durchschnitt?: number // nur für bewertung
}
