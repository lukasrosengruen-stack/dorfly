import { ABFALL_TYP_CONFIG, type AbfallTypSchluessel, type AbfallTypInfo } from './icsParser'

// ─── Typ-Definitionen ─────────────────────────────────────────────────────────

export type SammlungArtSchluessel = 'altpapier' | 'altkleider' | 'altglas' | 'schrott'

export interface SammlungArtInfo {
  label: string
  farbe: string
  bgFarbe: string
}

// ─── Feste Optionen (fest im Code, siehe Design-Spec) ────────────────────────

export const SAMMLUNG_ART_OPTIONEN: { value: SammlungArtSchluessel; label: string }[] = [
  { value: 'altpapier', label: 'Altpapiersammlung' },
  { value: 'altkleider', label: 'Altkleidersammlung' },
  { value: 'altglas', label: 'Altglassammlung' },
  { value: 'schrott', label: 'Schrottsammlung' },
]

export const SAMMLUNG_ART_CONFIG: Record<SammlungArtSchluessel, SammlungArtInfo> = {
  altpapier:  { label: 'Altpapiersammlung',  farbe: '#0284c7', bgFarbe: 'rgba(2,132,199,0.12)' },
  altkleider: { label: 'Altkleidersammlung', farbe: '#db2777', bgFarbe: 'rgba(219,39,119,0.12)' },
  altglas:    { label: 'Altglassammlung',    farbe: '#059669', bgFarbe: 'rgba(5,150,105,0.12)' },
  schrott:    { label: 'Schrottsammlung',    farbe: '#78716c', bgFarbe: 'rgba(120,113,108,0.12)' },
}

// ─── Präferenz-Schlüssel (für abfallkalender_praeferenzen.ausgewaehlte_typen) ─

export function sammlungPraeferenzSchluessel(art: SammlungArtSchluessel): string {
  return `sammlung_${art}`
}

export const SAMMLUNG_PRAEFERENZ_SCHLUESSEL: string[] =
  SAMMLUNG_ART_OPTIONEN.map(o => sammlungPraeferenzSchluessel(o.value))

// ─── Merge-Logik: posts → Kalender-Termine ───────────────────────────────────

export interface SammlungPost {
  id: string
  sammlung_art: string | null
  sammlung_datum: string | null
  sammlung_organisator: string | null
}

export interface SammlungTermin {
  id: string
  typ: string
  datum: string
  zeitpunkt: string
  organisator: string | null
}

/**
 * sammlung_datum ist ein timestamptz (Datum + Uhrzeit, analog veranstaltung_datum).
 * `datum` wird auf den reinen Kalendertag gekürzt, damit die Tages-Gruppierung im
 * Bürger-Kalender (die auf exakten String-Gleichheit von `datum` beruht) für
 * Sammlungen genauso funktioniert wie für die tagesgenauen Abfuhrtermine.
 * `zeitpunkt` behält den vollen Zeitstempel für die Uhrzeit-Anzeige.
 */
export function mapSammlungPostsZuTerminen(posts: SammlungPost[]): SammlungTermin[] {
  return posts
    .filter((p): p is SammlungPost & { sammlung_art: SammlungArtSchluessel; sammlung_datum: string } =>
      !!p.sammlung_art && p.sammlung_art in SAMMLUNG_ART_CONFIG && !!p.sammlung_datum)
    .map(p => ({
      id: p.id,
      typ: sammlungPraeferenzSchluessel(p.sammlung_art),
      datum: p.sammlung_datum.slice(0, 10),
      zeitpunkt: p.sammlung_datum,
      organisator: p.sammlung_organisator,
    }))
}

// ─── Einheitliche Anzeige-Konfiguration (Abfuhr-Typ ODER Sammlungsart) ───────

export function getTerminAnzeigeConfig(typ: string): AbfallTypInfo | SammlungArtInfo | null {
  if (typ in ABFALL_TYP_CONFIG) return ABFALL_TYP_CONFIG[typ as AbfallTypSchluessel]
  if (typ.startsWith('sammlung_')) {
    const art = typ.slice('sammlung_'.length) as SammlungArtSchluessel
    if (art in SAMMLUNG_ART_CONFIG) return SAMMLUNG_ART_CONFIG[art]
  }
  return null
}
