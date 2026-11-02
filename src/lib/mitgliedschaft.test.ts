import { describe, expect, it } from 'vitest'
import { kurzname, rpcFehler, vereinsEintraege } from './mitgliedschaft'

describe('rpcFehler', () => {
  it('übersetzt die Fehlercodes der SQL-Funktionen', () => {
    expect(rpcFehler({ code: '42501', message: 'Keine Berechtigung.' })).toEqual({ status: 403, meldung: 'Keine Berechtigung.' })
    expect(rpcFehler({ code: 'P0001', message: 'Der letzte Verwalter …' })).toEqual({ status: 409, meldung: 'Der letzte Verwalter …' })
    expect(rpcFehler({ code: 'P0002', message: 'Konto nicht gefunden.' })).toEqual({ status: 404, meldung: 'Konto nicht gefunden.' })
    expect(rpcFehler({ code: '22023', message: 'Bitte einen Namen angeben.' })).toEqual({ status: 400, meldung: 'Bitte einen Namen angeben.' })
  })

  it('verrät bei unbekannten Fehlern keine Interna', () => {
    expect(rpcFehler({ code: '23505', message: 'duplicate key value violates …' })).toEqual({
      status: 500, meldung: 'Die Aktion ist fehlgeschlagen. Bitte versuchen Sie es erneut.',
    })
  })
})

describe('kurzname', () => {
  it('Vorname und Initiale des Nachnamens', () => {
    expect(kurzname({ vorname: 'Anna', nachname: 'Berger', display_name: 'Anna Berger' })).toBe('Anna B.')
  })
  it('fällt auf display_name zurück', () => {
    expect(kurzname({ vorname: null, nachname: null, display_name: 'Anna' })).toBe('Anna')
  })
  it('null ohne Angaben', () => {
    expect(kurzname(null)).toBeNull()
    expect(kurzname({ vorname: null, nachname: null, display_name: null })).toBeNull()
  })
})

describe('vereinsEintraege', () => {
  it('zählt Mitglieder und Verwalter je Verein und Gewerbe', () => {
    const e = vereinsEintraege(
      [{ id: 'v1', verein_name: 'TSV', typ: 'verein' }, { id: 'v2', verein_name: 'Tafel', typ: 'organisation' }],
      [{ id: 'g1', name: 'Bäckerei' }],
      [
        { verein_id: 'v1', organisation_id: null, rolle: 'verwalter' },
        { verein_id: 'v1', organisation_id: null, rolle: 'autor' },
        { verein_id: null, organisation_id: 'g1', rolle: 'autor' },
        { verein_id: 'fremd', organisation_id: null, rolle: 'verwalter' },
      ],
    )
    expect(e).toEqual([
      { id: 'v1', name: 'TSV', typ: 'verein', mitglieder: 2, verwalter: 1 },
      { id: 'v2', name: 'Tafel', typ: 'organisation', mitglieder: 0, verwalter: 0 },
      { id: 'g1', name: 'Bäckerei', typ: 'gewerbe', mitglieder: 1, verwalter: 0 },
    ])
  })
})
