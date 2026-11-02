/**
 * Datenbanktest für Migration 065 (Mitgliedschaften) und 066.
 * Läuft gegen echtes Postgres (PGlite). Schema: src/lib/testing/pgliteSchema.ts
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { BASIS_SCHEMA, migration } from './testing/pgliteSchema'

const M064 = migration('064_konto_loeschen.sql')
const M065 = migration('065_mitgliedschaften.sql')

const G1 = '10000000-0000-0000-0000-000000000001'
const G2 = '10000000-0000-0000-0000-000000000002'
const VERWALTUNG = '00000000-0000-0000-0000-00000000000a'
const VERWALTUNG_G2 = '00000000-0000-0000-0000-00000000002a'
const ANNA = '00000000-0000-0000-0000-0000000000a1'      // Verwalterin Verein 1
const BERT = '00000000-0000-0000-0000-0000000000b1'      // Bürger
const CARL = '00000000-0000-0000-0000-0000000000c1'      // Bürger
const DORA = '00000000-0000-0000-0000-0000000000d1'      // Verwalterin Gewerbe
const RAT = '00000000-0000-0000-0000-0000000000e1'       // Gemeinderat
const FREMD = '00000000-0000-0000-0000-0000000000f1'     // Bürger aus G2

let db: PGlite

async function nutzer(id: string, email: string, role = 'buerger', gemeinde = G1) {
  await db.query('insert into auth.users (id, email) values ($1, $2)', [id, email])
  await db.query(
    'insert into public.profiles (id, role, email, gemeinde_id, display_name) values ($1, $2, $3, $4, $5)',
    [id, role, email, gemeinde, email.split('@')[0]],
  )
}

async function wert<T>(sql: string, params: unknown[] = []): Promise<T> {
  const res = await db.query<{ w: T }>(`select (${sql}) as w`, params)
  return res.rows[0].w
}

async function rolle(id: string) {
  return wert<string>('select role::text from public.profiles where id = $1', [id])
}

/** Frische DB; `vorher` läuft nach 064 und vor 065 (für Backfill-Tests). */
async function neueDb(vorher?: () => Promise<void>) {
  db = new PGlite()
  await db.exec(BASIS_SCHEMA)
  await db.exec(`insert into public.gemeinden (id) values ('${G1}'), ('${G2}')`)
  await db.exec(M064)
  await nutzer(VERWALTUNG, 'verwaltung@g1.de', 'verwaltung')
  await nutzer(VERWALTUNG_G2, 'verwaltung@g2.de', 'verwaltung', G2)
  if (vorher) await vorher()
  await db.exec(M065)
}

describe('065 — Backfill', () => {
  let verein: string
  let gewerbe: string

  beforeEach(async () => {
    await neueDb(async () => {
      await nutzer(ANNA, 'anna@example.de', 'verein')
      await nutzer(DORA, 'dora@example.de', 'gewerbe')
      verein = (await db.query<{ id: string }>(
        `insert into public.vereine (profile_id, gemeinde_id) values ($1, $2) returning id`, [ANNA, G1])).rows[0].id
      gewerbe = (await db.query<{ id: string }>(
        `insert into public.organisationen (profile_id, gemeinde_id) values ($1, $2) returning id`, [DORA, G1])).rows[0].id
      await db.query(`insert into public.posts (author_id, channel) values ($1, 'verein')`, [ANNA])
      await db.query(`insert into public.posts (author_id, channel) values ($1, 'gewerbe')`, [DORA])
    })
  })

  it('übernimmt bestehende Eigentümer als Verwalter', async () => {
    const rows = (await db.query<{ profile_id: string; verein_id: string | null; organisation_id: string | null; rolle: string }>(
      'select profile_id, verein_id, organisation_id, rolle from public.mitgliedschaften order by profile_id',
    )).rows
    expect(rows).toEqual([
      { profile_id: ANNA, verein_id: verein, organisation_id: null, rolle: 'verwalter' },
      { profile_id: DORA, verein_id: null, organisation_id: gewerbe, rolle: 'verwalter' },
    ])
  })

  it('ordnet Alt-Beiträge ohne org_id dem Verein bzw. Gewerbe des Autors zu', async () => {
    expect(await wert<string>(`select org_id from public.posts where channel = 'verein'`)).toBe(verein)
    expect(await wert<string>(`select org_id from public.posts where channel = 'gewerbe'`)).toBe(gewerbe)
  })

  it('lässt eine zweite Mitgliedschaft derselben Person nicht zu', async () => {
    await expect(db.query(
      `insert into public.mitgliedschaften (profile_id, organisation_id, rolle) values ($1, $2, 'autor')`, [ANNA, gewerbe],
    )).rejects.toThrow(/duplicate key/)
  })

  it('verlangt genau ein Ziel', async () => {
    await nutzer(BERT, 'bert@example.de')
    await expect(db.query(
      `insert into public.mitgliedschaften (profile_id, verein_id, organisation_id, rolle) values ($1, $2, $3, 'autor')`,
      [BERT, verein, gewerbe],
    )).rejects.toThrow(/check constraint/)
  })
})

describe('065 — Vorbedingung', () => {
  it('bricht ab, wenn eine Person mehreren Vereinen/Gewerben zugeordnet ist', async () => {
    await expect(neueDb(async () => {
      await nutzer(ANNA, 'anna@example.de', 'verein')
      await db.query(`insert into public.vereine (profile_id, gemeinde_id) values ($1, $2)`, [ANNA, G1])
      await db.query(`insert into public.organisationen (profile_id, gemeinde_id) values ($1, $2)`, [ANNA, G1])
    })).rejects.toThrow(/mehreren Vereinen/)
  })
})
