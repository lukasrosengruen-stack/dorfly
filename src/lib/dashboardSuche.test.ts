import { describe, it, expect } from 'vitest'
import { escapeIlike, SUCH_TYPEN } from './dashboardSuche'

describe('escapeIlike', () => {
  it('laesst harmlosen Text unveraendert', () => {
    expect(escapeIlike('Sommerfest')).toBe('Sommerfest')
  })

  it('maskiert Prozentzeichen', () => {
    expect(escapeIlike('50%')).toBe('50\\%')
  })

  it('maskiert Unterstriche', () => {
    expect(escapeIlike('A_B')).toBe('A\\_B')
  })

  it('maskiert den Backslash zuerst, damit keine Doppelmaskierung entsteht', () => {
    expect(escapeIlike('a\\b')).toBe('a\\\\b')
  })

  it('maskiert mehrere Sonderzeichen gemeinsam', () => {
    expect(escapeIlike('%_%')).toBe('\\%\\_\\%')
  })
})

describe('SUCH_TYPEN', () => {
  it('enthaelt genau die vier unterstuetzten Listen', () => {
    expect(SUCH_TYPEN).toEqual(['beitraege', 'maengel', 'fragen', 'warnmeldungen'])
  })
})
