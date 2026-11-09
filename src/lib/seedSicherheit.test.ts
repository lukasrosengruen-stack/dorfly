import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  baueSeedSql,
  DEV_PROJEKT_REF,
  DEV_ZIEL_ARGUMENTE,
  GEHEIMNIS_MARKER,
  plusAdresse,
  pruefePasswort,
  seedZiel,
  sqlText,
} from './seedSicherheit'

const PROD_REF = 'hzptnylfdfibijkgtfhf'
const SEED = readFileSync(path.resolve(__dirname, '../../supabase/seed.sql'), 'utf8')
const SKRIPT = readFileSync(path.resolve(__dirname, '../../scripts/seed-dev.mjs'), 'utf8')
const WERTE = { passwort: 'ein-testpasswort', plusBasis: 'name@example.org' }

describe('seedZiel', () => {
  it('kennt nur die Entwicklung und lokal', () => {
    expect(seedZiel([])).toBe('dev')
    expect(seedZiel(['--lokal'])).toBe('lokal')
    expect(DEV_ZIEL_ARGUMENTE).toEqual([`--remote=${DEV_PROJEKT_REF}`, '--yes'])
  })

  for (const argumente of [[PROD_REF], [`--remote=${PROD_REF}`], ['--lokal', `--remote=${PROD_REF}`], ['production'], ['']]) {
    it(`lehnt ${JSON.stringify(argumente)} ab`, () => {
      expect(() => seedZiel(argumente)).toThrow(/Ein anderes Ziel gibt es nicht/)
    })
  }
})

describe('Schutz vor der Produktion', () => {
  it('die Produktions-Referenz steht weder im Skript noch im Seed', () => {
    expect(SKRIPT).not.toContain(PROD_REF)
    expect(SEED).not.toContain(PROD_REF)
  })

  it('die Sperre läuft vor dem ersten Schreiben', () => {
    const sperre = SEED.indexOf('seed.sql abgebrochen')
    const erstesInsert = SEED.search(/^\s*insert into/m)
    expect(sperre).toBeGreaterThan(-1)
    expect(sperre).toBeLessThan(erstesInsert)
  })

  it('die Geheimnisse landen hinter der Sperre und in derselben Transaktion', () => {
    const sql = baueSeedSql(SEED, WERTE)
    const sperre = sql.indexOf('seed.sql abgebrochen')
    const passwort = sql.indexOf(WERTE.passwort)
    expect(passwort).toBeGreaterThan(sperre)
    expect(passwort).toBeLessThan(sql.lastIndexOf('commit;'))
  })
})

describe('Geheimnisse', () => {
  it('der Seed enthält keine Passwörter und keine echten Adressen', () => {
    expect(SEED).not.toMatch(/encrypted_password/)
    const adressen = SEED.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/gi) ?? []
    expect(adressen.filter(a => !a.endsWith('.invalid'))).toEqual([])
  })

  it('verlangt ein ausreichend langes Passwort', () => {
    expect(() => pruefePasswort(undefined)).toThrow(/SEED_TESTPASSWORT/)
    expect(() => pruefePasswort('kurz')).toThrow(/SEED_TESTPASSWORT/)
    expect(pruefePasswort('lang-genug-1')).toBe('lang-genug-1')
  })

  it('maskiert Anführungszeichen', () => {
    expect(sqlText("a'b; drop table x;--")).toBe("'a''b; drop table x;--'")
  })

  it('übernimmt Dollarzeichen im Passwort wörtlich', () => {
    const sql = baueSeedSql(SEED, { ...WERTE, passwort: "a$&b$'c-lang" })
    expect(sql).toContain("a$&b$''c-lang")
  })

  it('verlangt die Markierung genau einmal', () => {
    expect(() => baueSeedSql('begin; commit;', WERTE)).toThrow(/Markierung/)
    expect(() => baueSeedSql(`${GEHEIMNIS_MARKER}\n${GEHEIMNIS_MARKER}`, WERTE)).toThrow(/Markierung/)
  })
})

describe('plusAdresse', () => {
  it('bildet je Gemeinde eine eigene Adresse', () => {
    expect(plusAdresse('name@example.org', 'testdorf')).toBe('name+testdorf@example.org')
    expect(plusAdresse('name+dorfly@example.org', 'musterhausen')).toBe('name+dorfly-musterhausen@example.org')
  })

  for (const basis of ['', 'keine-adresse', "a'b@example.org", 'a@b']) {
    it(`lehnt "${basis}" ab`, () => {
      expect(() => plusAdresse(basis, 'testdorf')).toThrow(/SEED_PLUS_ADRESSE/)
    })
  }
})
