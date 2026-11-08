/**
 * Datenbanktest für Migration 070: Wer zur Gemeinde gehört, hat standardmäßig
 * alle Vereine, Organisationen und Betriebe abonniert und kann aktiv abbestellen.
 * Läuft gegen echtes Postgres (PGlite). Schema: src/lib/testing/pgliteSchema.ts
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { BASIS_SCHEMA, migration } from './testing/pgliteSchema'

const M070 = migration('070_abonnements_standard_alles.sql')

const G1 = '10000000-0000-0000-0000-000000000001'
const G2 = '10000000-0000-0000-0000-000000000002'

const ALT = '00000000-0000-0000-0000-0000000000a1'      // schon vor der Migration in G1
const FREMD = '00000000-0000-0000-0000-0000000000f1'    // schon vor der Migration in G2
const NEU = '00000000-0000-0000-0000-0000000000b1'

// Stand nach 065: Vereine und Betriebe brauchen kein eigenes Profil mehr
const ERGAENZUNG = `
  alter table public.vereine alter column profile_id drop not null;
  alter table public.vereine drop constraint vereine_profile_id_key;
  alter table public.organisationen alter column profile_id drop not null;
`

let db: PGlite
let tsv: string
let tafel: string
let baecker: string
let schuleG1: string
let vereinG2: string

async function nutzer(id: string, gemeinde: string | null) {
  await db.query('insert into auth.users (id) values ($1)', [id])
  await db.query('insert into public.profiles (id, gemeinde_id) values ($1, $2)', [id, gemeinde])
}

async function verein(gemeinde: string, typ: 'verein' | 'organisation' = 'verein') {
  return (await db.query<{ id: string }>(
    'insert into public.vereine (gemeinde_id, typ) values ($1, $2) returning id', [gemeinde, typ])).rows[0].id
}

async function organisation(gemeinde: string, typ: 'gewerbe' | 'institution' | 'verein' = 'gewerbe') {
  return (await db.query<{ id: string }>(
    'insert into public.organisationen (gemeinde_id, typ) values ($1, $2) returning id', [gemeinde, typ])).rows[0].id
}

async function vereinsAbos(user: string) {
  return (await db.query<{ verein_id: string }>(
    'select verein_id from public.verein_abonnements where user_id = $1 order by verein_id', [user])).rows.map(r => r.verein_id)
}

async function gewerbeAbos(user: string) {
  return (await db.query<{ gewerbe_id: string }>(
    'select gewerbe_id from public.gewerbe_abonnements where user_id = $1 order by gewerbe_id', [user])).rows.map(r => r.gewerbe_id)
}

const sortiert = (ids: string[]) => [...ids].sort()

beforeEach(async () => {
  db = new PGlite()
  await db.exec(BASIS_SCHEMA)
  await db.exec(ERGAENZUNG)
  await db.exec(`insert into public.gemeinden (id) values ('${G1}'), ('${G2}')`)

  // Bestand vor der Migration
  await nutzer(ALT, G1)
  await nutzer(FREMD, G2)
  tsv = await verein(G1)
  tafel = await verein(G1, 'organisation')
  baecker = await organisation(G1)
  schuleG1 = await organisation(G1, 'institution')
  vereinG2 = await verein(G2)
  await db.query('insert into public.verein_abonnements (user_id, verein_id) values ($1, $2)', [ALT, tsv])

  await db.exec(M070)
})

describe('070: standardmäßig alles abonniert', () => {
  it('holt fuer bestehende Nutzer alle Abos ihrer Gemeinde nach, ohne doppelte Eintraege', async () => {
    expect(await vereinsAbos(ALT)).toEqual(sortiert([tsv, tafel]))
    expect(await gewerbeAbos(ALT)).toEqual([baecker])
  })

  it('abonniert nichts aus fremden Gemeinden', async () => {
    expect(await vereinsAbos(FREMD)).toEqual([vereinG2])
    expect(await gewerbeAbos(FREMD)).toEqual([])
  })

  it('abonniert nur Betriebe, keine anderen Organisationstypen', async () => {
    expect(await gewerbeAbos(ALT)).not.toContain(schuleG1)
  })

  it('gibt neuen Nutzern alle Vereine, Organisationen und Betriebe ihrer Gemeinde', async () => {
    await nutzer(NEU, G1)

    expect(await vereinsAbos(NEU)).toEqual(sortiert([tsv, tafel]))
    expect(await gewerbeAbos(NEU)).toEqual([baecker])
  })

  it('abonniert alles, sobald ein Nutzer ohne Gemeinde eine bekommt', async () => {
    await nutzer(NEU, null)
    expect(await vereinsAbos(NEU)).toEqual([])

    await db.query('update public.profiles set gemeinde_id = $1 where id = $2', [G1, NEU])

    expect(await vereinsAbos(NEU)).toEqual(sortiert([tsv, tafel]))
  })

  it('laesst Abbestellungen bestehen, wenn sich am Profil etwas anderes aendert', async () => {
    await db.query('delete from public.verein_abonnements where user_id = $1 and verein_id = $2', [ALT, tsv])

    await db.query(`update public.profiles set display_name = 'Neuer Name' where id = $1`, [ALT])

    expect(await vereinsAbos(ALT)).toEqual([tafel])
  })

  it('abonniert einen neuen Verein fuer alle Nutzer seiner Gemeinde', async () => {
    const neu = await verein(G1)

    expect(await vereinsAbos(ALT)).toContain(neu)
    expect(await vereinsAbos(FREMD)).not.toContain(neu)
  })

  it('abonniert einen neuen Betrieb fuer alle Nutzer seiner Gemeinde', async () => {
    const neu = await organisation(G1)

    expect(await gewerbeAbos(ALT)).toContain(neu)
    expect(await gewerbeAbos(FREMD)).not.toContain(neu)
  })

  it('abonniert neue Organisationen, die kein Betrieb sind, nicht als Gewerbe', async () => {
    const neu = await organisation(G1, 'institution')

    expect(await gewerbeAbos(ALT)).not.toContain(neu)
  })

  it('funktioniert auch, wenn ein angemeldeter Nutzer den Verein anlegt', async () => {
    await db.exec(`
      alter table public.verein_abonnements enable row level security;
      create policy eigene on public.verein_abonnements for all to authenticated using (user_id = auth.uid());
      grant select, insert, delete on public.verein_abonnements to authenticated;
    `)
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${ALT}', false);`)

    await db.query('insert into public.vereine (gemeinde_id) values ($1)', [G1])

    await db.exec('reset role')
    expect((await db.query<{ n: number }>(
      'select count(*)::int as n from public.verein_abonnements where user_id = $1', [FREMD])).rows[0].n).toBe(1)
  })
})
