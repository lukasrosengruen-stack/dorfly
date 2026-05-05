/**
 * ICS-Parser für Abfallkalender-Daten
 *
 * Reine Funktion – keine Seiteneffekte, vollständig unit-testbar.
 * Unterstützt UTF-8 und erkennt fehlerhafte Mojibake-Kodierungen.
 */

// ─── Typ-Definitionen ─────────────────────────────────────────────────────────

export type AbfallTypSchluessel =
  | 'biomuell'
  | 'wertstoffe'
  | 'restmuell_120_240'
  | 'papier_120_240'
  | 'papier_ab_1100'
  | 'restmuell_1100_woechentlich'
  | 'restmuell_1100_zweimal'
  | 'restmuell_1100_vierfach'
  | 'restmuell_2500_woechentlich'
  | 'restmuell_2500_zweimal'
  | 'restmuell_2500_vierfach'

export interface AbfallTypInfo {
  label: string
  farbe: string
  bgFarbe: string
}

// ─── Anzeige-Konfiguration pro Abfallart ─────────────────────────────────────

export const ABFALL_TYP_CONFIG: Record<AbfallTypSchluessel, AbfallTypInfo> = {
  biomuell: {
    label: 'Biomüll',
    farbe: '#16a34a',
    bgFarbe: 'rgba(22,163,74,0.12)',
  },
  wertstoffe: {
    label: 'Wertstoffe',
    farbe: '#ca8a04',
    bgFarbe: 'rgba(202,138,4,0.12)',
  },
  restmuell_120_240: {
    label: 'Restmüll 120l/240l',
    farbe: '#6b7280',
    bgFarbe: 'rgba(107,114,128,0.12)',
  },
  papier_120_240: {
    label: 'Papier 120l/240l',
    farbe: '#2563eb',
    bgFarbe: 'rgba(37,99,235,0.12)',
  },
  papier_ab_1100: {
    label: 'Papier ab 1.100l',
    farbe: '#1d4ed8',
    bgFarbe: 'rgba(29,78,216,0.12)',
  },
  restmuell_1100_woechentlich: {
    label: 'Restmüll 1.100l (wöchentlich)',
    farbe: '#4b5563',
    bgFarbe: 'rgba(75,85,99,0.12)',
  },
  restmuell_1100_zweimal: {
    label: 'Restmüll 1.100l (zweiwöchentlich)',
    farbe: '#4b5563',
    bgFarbe: 'rgba(75,85,99,0.12)',
  },
  restmuell_1100_vierfach: {
    label: 'Restmüll 1.100l (vierwöchentlich)',
    farbe: '#4b5563',
    bgFarbe: 'rgba(75,85,99,0.12)',
  },
  restmuell_2500_woechentlich: {
    label: 'Restmüll ab 2.500l (wöchentlich)',
    farbe: '#374151',
    bgFarbe: 'rgba(55,65,81,0.12)',
  },
  restmuell_2500_zweimal: {
    label: 'Restmüll ab 2.500l (zweiwöchentlich)',
    farbe: '#374151',
    bgFarbe: 'rgba(55,65,81,0.12)',
  },
  restmuell_2500_vierfach: {
    label: 'Restmüll ab 2.500l (vierwöchentlich)',
    farbe: '#374151',
    bgFarbe: 'rgba(55,65,81,0.12)',
  },
}

export const ALLE_ABFALL_TYPEN = Object.keys(ABFALL_TYP_CONFIG) as AbfallTypSchluessel[]

// ─── SUMMARY → interner Schlüssel ────────────────────────────────────────────

const SUMMARY_MAP: Record<string, AbfallTypSchluessel> = {
  // Korrekt dekodiert (UTF-8)
  'Biomüll': 'biomuell',
  'Wertstoffe': 'wertstoffe',
  'Restmüll 120l/240l': 'restmuell_120_240',
  'Papier 120l/240l': 'papier_120_240',
  'Papier ab 1.100l': 'papier_ab_1100',
  'Restmüll 1.100l (wöchentlich)': 'restmuell_1100_woechentlich',
  'Restmüll 1.100l (zweiwöchentlich)': 'restmuell_1100_zweimal',
  'Restmüll 1.100l (vierwöchentlich)': 'restmuell_1100_vierfach',
  'Restmüll ab 2.500l (wöchentlich)': 'restmuell_2500_woechentlich',
  'Restmüll ab 2.500l (zweiwöchentlich)': 'restmuell_2500_zweimal',
  'Restmüll ab 2.500l (vierwöchentlich)': 'restmuell_2500_vierfach',
  // Mojibake-Fallback: UTF-8-Bytes als Latin-1 fehlinterpretiert (nur Einträge mit Sonderzeichen)
  'BiomÃ¼ll': 'biomuell',
  'RestmÃ¼ll 120l/240l': 'restmuell_120_240',
  'RestmÃ¼ll 1.100l (wÃ¶chentlich)': 'restmuell_1100_woechentlich',
  'RestmÃ¼ll 1.100l (zweiwÃ¶chentlich)': 'restmuell_1100_zweimal',
  'RestmÃ¼ll 1.100l (vierwÃ¶chentlich)': 'restmuell_1100_vierfach',
  'RestmÃ¼ll ab 2.500l (wÃ¶chentlich)': 'restmuell_2500_woechentlich',
  'RestmÃ¼ll ab 2.500l (zweiwÃ¶chentlich)': 'restmuell_2500_zweimal',
  'RestmÃ¼ll ab 2.500l (vierwÃ¶chentlich)': 'restmuell_2500_vierfach',
}

// ─── Normalisierung ───────────────────────────────────────────────────────────

/**
 * Korrigiert häufige Mojibake-Muster (UTF-8-Bytes als Latin-1 dekodiert).
 * Macht den Parser robust gegen falsch gelesene ICS-Dateien.
 */
export function normalizeMojibake(s: string): string {
  return s
    .replace(/Ã¼/g, 'ü')
    .replace(/Ã¶/g, 'ö')
    .replace(/Ã¤/g, 'ä')
    .replace(/Ãœ/g, 'Ü')
    .replace(/Ã–/g, 'Ö')
    .replace(/Ã„/g, 'Ä')
    .replace(/ÃŸ/g, 'ß')
    .trim()
}

// ─── Öffentliche API ──────────────────────────────────────────────────────────

export interface ParsedEvent {
  datum: string               // 'YYYY-MM-DD'
  typ: AbfallTypSchluessel
}

export interface ParseResult {
  events: ParsedEvent[]
  unbekannteTypen: string[]   // SUMMARY-Werte ohne Mapping (zur Diagnose)
  fehler?: string
}

/**
 * Liest alle VEVENT-Einträge aus einem ICS-String.
 * Gibt erkannte Termine und unbekannte SUMMARY-Werte zurück.
 */
export function parseIcs(content: string): ParseResult {
  if (!content.includes('BEGIN:VCALENDAR')) {
    return { events: [], unbekannteTypen: [], fehler: 'Keine gültige ICS-Datei (BEGIN:VCALENDAR fehlt)' }
  }

  const events: ParsedEvent[] = []
  const unbekannteSet = new Set<string>()

  const blocks = content.split('BEGIN:VEVENT').slice(1)

  for (const block of blocks) {
    const lines = block.split(/\r?\n/)
    let datum: string | null = null
    let summary: string | null = null

    for (const line of lines) {
      if (line.startsWith('DTSTART')) {
        const match = line.match(/:(\d{8})/)
        if (match) {
          const raw = match[1]
          datum = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
        }
      } else if (line.startsWith('SUMMARY:')) {
        summary = line.slice('SUMMARY:'.length).trim()
      }
    }

    if (!datum || !summary) continue

    // Erst normalisieren, dann direkt in der Map nachschlagen
    const normalized = normalizeMojibake(summary)
    const typ = SUMMARY_MAP[normalized] ?? SUMMARY_MAP[summary]

    if (!typ) {
      unbekannteSet.add(summary)
      continue
    }

    events.push({ datum, typ })
  }

  return { events, unbekannteTypen: Array.from(unbekannteSet) }
}

/**
 * Bildet einen einzelnen SUMMARY-String auf den internen Schlüssel ab.
 * Gibt null zurück wenn kein Mapping existiert.
 */
export function mapSummaryToTyp(summary: string): AbfallTypSchluessel | null {
  const normalized = normalizeMojibake(summary)
  return SUMMARY_MAP[normalized] ?? SUMMARY_MAP[summary] ?? null
}
