import { describe, it, expect } from 'vitest'
import { PUBLIC_POST_SELECT } from './publicPostQuery'

// Die oeffentliche Post-Seite (/posts/[id]) fragt als anon ab, weil der Empfaenger
// eines geteilten Links in der Regel nicht eingeloggt ist. Spricht die Query eine
// Relation an, die anon nicht lesen darf, lehnt PostgREST die GESAMTE Query mit
// 42501 ab — die Seite lieferte dann 404 statt des Beitrags.
const FUER_ANON_GESPERRT = ['profiles', 'maengel', 'fragen', 'umfragen']

describe('PUBLIC_POST_SELECT', () => {
  it('liest Autorendaten ueber die maskierte View profiles_public', () => {
    expect(PUBLIC_POST_SELECT).toContain('profiles_public')
  })

  it('spricht keine fuer anon gesperrte Relation an', () => {
    for (const relation of FUER_ANON_GESPERRT) {
      expect(PUBLIC_POST_SELECT).not.toContain(`${relation}(`)
    }
  })

  it('enthaelt die Felder, die die Seite rendert', () => {
    for (const feld of ['titel', 'inhalt', 'published_at', 'gemeinden(name)']) {
      expect(PUBLIC_POST_SELECT).toContain(feld)
    }
  })
})
