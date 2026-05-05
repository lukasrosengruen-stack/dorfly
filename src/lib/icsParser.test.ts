import { describe, it, expect } from 'vitest'
import { parseIcs, mapSummaryToTyp, normalizeMojibake, ABFALL_TYP_CONFIG, ALLE_ABFALL_TYPEN } from './icsParser'

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function makeIcs(events: { dtstart: string; summary: string }[]): string {
  const vevents = events
    .map(
      e => `BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:${e.dtstart}\r\nSUMMARY:${e.summary}\r\nEND:VEVENT`,
    )
    .join('\r\n')
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${vevents}\r\nEND:VCALENDAR`
}

// ─── normalizeMojibake ────────────────────────────────────────────────────────

describe('normalizeMojibake', () => {
  it('konvertiert Ã¼ zu ü', () => {
    expect(normalizeMojibake('BiomÃ¼ll')).toBe('Biomüll')
  })

  it('konvertiert Ã¶ zu ö', () => {
    expect(normalizeMojibake('wÃ¶chentlich')).toBe('wöchentlich')
  })

  it('konvertiert alle deutschen Sonderzeichen', () => {
    expect(normalizeMojibake('Ã¤Ã¶Ã¼ÃœÃ–Ã„ÃŸ')).toBe('äöüÜÖÄß')
  })

  it('lässt korrekte UTF-8-Strings unverändert', () => {
    expect(normalizeMojibake('Biomüll')).toBe('Biomüll')
  })

  it('trimmt Whitespace', () => {
    expect(normalizeMojibake('  Biomüll  ')).toBe('Biomüll')
  })
})

// ─── mapSummaryToTyp ──────────────────────────────────────────────────────────

describe('mapSummaryToTyp', () => {
  it('mappt korrekt dekodierte UTF-8-Strings', () => {
    expect(mapSummaryToTyp('Biomüll')).toBe('biomuell')
    expect(mapSummaryToTyp('Wertstoffe')).toBe('wertstoffe')
    expect(mapSummaryToTyp('Papier 120l/240l')).toBe('papier_120_240')
    expect(mapSummaryToTyp('Papier ab 1.100l')).toBe('papier_ab_1100')
    expect(mapSummaryToTyp('Restmüll 120l/240l')).toBe('restmuell_120_240')
    expect(mapSummaryToTyp('Restmüll 1.100l (wöchentlich)')).toBe('restmuell_1100_woechentlich')
    expect(mapSummaryToTyp('Restmüll 1.100l (zweiwöchentlich)')).toBe('restmuell_1100_zweimal')
    expect(mapSummaryToTyp('Restmüll 1.100l (vierwöchentlich)')).toBe('restmuell_1100_vierfach')
    expect(mapSummaryToTyp('Restmüll ab 2.500l (wöchentlich)')).toBe('restmuell_2500_woechentlich')
    expect(mapSummaryToTyp('Restmüll ab 2.500l (zweiwöchentlich)')).toBe('restmuell_2500_zweimal')
    expect(mapSummaryToTyp('Restmüll ab 2.500l (vierwöchentlich)')).toBe('restmuell_2500_vierfach')
  })

  it('mappt Mojibake-kodierte Strings (Latin-1 über UTF-8)', () => {
    expect(mapSummaryToTyp('BiomÃ¼ll')).toBe('biomuell')
    expect(mapSummaryToTyp('RestmÃ¼ll 120l/240l')).toBe('restmuell_120_240')
    expect(mapSummaryToTyp('RestmÃ¼ll 1.100l (wÃ¶chentlich)')).toBe('restmuell_1100_woechentlich')
    expect(mapSummaryToTyp('RestmÃ¼ll ab 2.500l (zweiwÃ¶chentlich)')).toBe('restmuell_2500_zweimal')
  })

  it('gibt null für unbekannte Typen zurück', () => {
    expect(mapSummaryToTyp('Sperrmüll')).toBeNull()
    expect(mapSummaryToTyp('')).toBeNull()
    expect(mapSummaryToTyp('Unbekannte Abfallart')).toBeNull()
  })
})

// ─── parseIcs – Fehlerbehandlung ─────────────────────────────────────────────

describe('parseIcs – Fehlerbehandlung', () => {
  it('gibt Fehler bei leerem String zurück', () => {
    const result = parseIcs('')
    expect(result.fehler).toBeDefined()
    expect(result.events).toHaveLength(0)
  })

  it('gibt Fehler zurück wenn BEGIN:VCALENDAR fehlt', () => {
    const result = parseIcs('BEGIN:VEVENT\nDTSTART:20260105\nSUMMARY:Biomüll\nEND:VEVENT')
    expect(result.fehler).toBeDefined()
  })

  it('ignoriert VEVENT-Blöcke ohne DTSTART', () => {
    const ics = 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:Biomüll\nEND:VEVENT\nEND:VCALENDAR'
    const result = parseIcs(ics)
    expect(result.events).toHaveLength(0)
    expect(result.fehler).toBeUndefined()
  })

  it('ignoriert VEVENT-Blöcke ohne SUMMARY', () => {
    const ics = 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20260105\nEND:VEVENT\nEND:VCALENDAR'
    const result = parseIcs(ics)
    expect(result.events).toHaveLength(0)
  })

  it('meldet unbekannte SUMMARY-Werte in unbekannteTypen', () => {
    const ics = makeIcs([{ dtstart: '20260105', summary: 'Sperrmüll' }])
    const result = parseIcs(ics)
    expect(result.events).toHaveLength(0)
    expect(result.unbekannteTypen).toContain('Sperrmüll')
  })
})

// ─── parseIcs – erfolgreiche Fälle ───────────────────────────────────────────

describe('parseIcs – erfolgreiche Fälle', () => {
  it('liest ein einzelnes korrekt kodiertes Event', () => {
    const ics = makeIcs([{ dtstart: '20260105', summary: 'Biomüll' }])
    const result = parseIcs(ics)
    expect(result.fehler).toBeUndefined()
    expect(result.events).toHaveLength(1)
    expect(result.events[0]).toEqual({ datum: '2026-01-05', typ: 'biomuell' })
  })

  it('liest Mojibake-kodierte Events', () => {
    const ics = makeIcs([{ dtstart: '20260107', summary: 'RestmÃ¼ll 1.100l (wÃ¶chentlich)' }])
    const result = parseIcs(ics)
    expect(result.events).toHaveLength(1)
    expect(result.events[0]).toEqual({ datum: '2026-01-07', typ: 'restmuell_1100_woechentlich' })
  })

  it('liest mehrere Events und konvertiert Datum korrekt', () => {
    const ics = makeIcs([
      { dtstart: '20260105', summary: 'Biomüll' },
      { dtstart: '20260105', summary: 'Wertstoffe' },
      { dtstart: '20260107', summary: 'Restmüll 1.100l (wöchentlich)' },
      { dtstart: '20261231', summary: 'Papier ab 1.100l' },
    ])
    const result = parseIcs(ics)
    expect(result.events).toHaveLength(4)
    expect(result.events.map(e => e.datum)).toEqual([
      '2026-01-05',
      '2026-01-05',
      '2026-01-07',
      '2026-12-31',
    ])
  })

  it('verarbeitet alle 11 Abfallarten korrekt', () => {
    const summaries = [
      ['Biomüll', 'biomuell'],
      ['Wertstoffe', 'wertstoffe'],
      ['Restmüll 120l/240l', 'restmuell_120_240'],
      ['Papier 120l/240l', 'papier_120_240'],
      ['Papier ab 1.100l', 'papier_ab_1100'],
      ['Restmüll 1.100l (wöchentlich)', 'restmuell_1100_woechentlich'],
      ['Restmüll 1.100l (zweiwöchentlich)', 'restmuell_1100_zweimal'],
      ['Restmüll 1.100l (vierwöchentlich)', 'restmuell_1100_vierfach'],
      ['Restmüll ab 2.500l (wöchentlich)', 'restmuell_2500_woechentlich'],
      ['Restmüll ab 2.500l (zweiwöchentlich)', 'restmuell_2500_zweimal'],
      ['Restmüll ab 2.500l (vierwöchentlich)', 'restmuell_2500_vierfach'],
    ] as const

    const ics = makeIcs(summaries.map((s, i) => ({ dtstart: `2026010${(i + 1).toString().padStart(2, '0')}`, summary: s[0] })))
    const result = parseIcs(ics)

    expect(result.events).toHaveLength(11)
    expect(result.unbekannteTypen).toHaveLength(0)
    summaries.forEach(([, typ], i) => {
      expect(result.events[i].typ).toBe(typ)
    })
  })

  it('handhabt gemischte bekannte und unbekannte Typen', () => {
    const ics = makeIcs([
      { dtstart: '20260105', summary: 'Biomüll' },
      { dtstart: '20260106', summary: 'Sperrmüll' },
      { dtstart: '20260107', summary: 'Wertstoffe' },
    ])
    const result = parseIcs(ics)
    expect(result.events).toHaveLength(2)
    expect(result.unbekannteTypen).toEqual(['Sperrmüll'])
  })

  it('unterstützt DTSTART ohne VALUE=DATE-Präfix', () => {
    const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20260115\r\nSUMMARY:Biomüll\r\nEND:VEVENT\r\nEND:VCALENDAR'
    const result = parseIcs(ics)
    expect(result.events[0]?.datum).toBe('2026-01-15')
  })

  it('parst die reale Ehningen-ICS-Struktur korrekt (Stichprobe)', () => {
    const realBlock = `BEGIN:VCALENDAR
PRODID:-//K4SYSTEMS//ABFALLPLUS//DE
VERSION:2.0
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260105
DTEND;VALUE=DATE:20260106
SUMMARY:Biomüll
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260107
DTEND;VALUE=DATE:20260108
SUMMARY:Restmüll 1.100l (wöchentlich)
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20261229
DTEND;VALUE=DATE:20261230
SUMMARY:Restmüll ab 2.500l (vierwöchentlich)
END:VEVENT
END:VCALENDAR`

    const result = parseIcs(realBlock)
    expect(result.fehler).toBeUndefined()
    expect(result.events).toHaveLength(3)
    expect(result.events[0]).toEqual({ datum: '2026-01-05', typ: 'biomuell' })
    expect(result.events[1]).toEqual({ datum: '2026-01-07', typ: 'restmuell_1100_woechentlich' })
    expect(result.events[2]).toEqual({ datum: '2026-12-29', typ: 'restmuell_2500_vierfach' })
  })
})

// ─── ABFALL_TYP_CONFIG Vollständigkeit ───────────────────────────────────────

describe('ABFALL_TYP_CONFIG', () => {
  it('hat für jeden Schlüssel in ALLE_ABFALL_TYPEN einen Eintrag', () => {
    for (const typ of ALLE_ABFALL_TYPEN) {
      expect(ABFALL_TYP_CONFIG[typ]).toBeDefined()
      expect(ABFALL_TYP_CONFIG[typ].label).toBeTruthy()
      expect(ABFALL_TYP_CONFIG[typ].farbe).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})
