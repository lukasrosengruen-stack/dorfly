/**
 * Datenbanktest für Migration 068 (superadmin_produzentenaccounts nach Mitgliedschaften).
 * Läuft gegen echtes Postgres (PGlite). Schema: src/lib/testing/pgliteSchema.ts
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { BASIS_SCHEMA, migration } from './testing/pgliteSchema'

const M068 = migration('068_superadmin_produzenten_mitgliedschaften.sql')

const G1 = '10000000-0000-0000-0000-000000000001'
const G2 = '10000000-0000-0000-0000-000000000002'

// Stand nach 065 (profile_id / author_id nullable) plus Spalten, die nur diese Funktion braucht
const ERGAENZUNG = `
  alter table public.vereine alter column profile_id drop not null;
  alter table public.vereine drop constraint vereine_profile_id_key;
  alter table public.organisationen alter column profile_id drop not null;
  alter table public.posts alter column author_id drop not null;
  alter table public.posts alter column gemeinde_id set default '${G1}';
  alter table public.posts add column status text not null default 'published';
  alter table public.posts add column published_at timestamptz default now();
  alter table public.profiles add column created_at timestamptz default now();
  alter table public.vereine add column created_at timestamptz default now();
  alter table public.organisationen add column created_at timestamptz default now();
`

const ANNA = '00000000-0000-0000-0000-0000000000a1'
const BERT = '00000000-0000-0000-0000-0000000000b1'
const DORA = '00000000-0000-0000-0000-0000000000d1'
const VERW = '00000000-0000-0000-0000-00000000000a'
const LESER = '00000000-0000-0000-0000-0000000000c1'

let db: PGlite

type Zeile = { id: string; name: string; posts_7d: number; posts_30d: number; subscribers: number | null; is_active: boolean }

async function nutzer(id: string, role: string, name: string, gemeinde = G1) {
  await db.query('insert into auth.users (id) values ($1)', [id])
  await db.query('insert into public.profiles (id, role, display_name, gemeinde_id) values ($1, $2, $3, $4)', [id, role, name, gemeinde])
}

async function abfrage(rolle: string, gemeinde: string | null = G1): Promise<Zeile[]> {
  const res = await db.query<{ j: Zeile[] }>('select public.superadmin_produzentenaccounts($1, $2) as j', [rolle, gemeinde])
  return res.rows[0].j
}

let tsv: string
let tafel: string
let baecker: string

beforeEach(async () => {
  db = new PGlite()
  await db.exec(BASIS_SCHEMA)
  await db.exec(ERGAENZUNG)
  await db.exec(`insert into public.gemeinden (id) values ('${G1}'), ('${G2}')`)
  await db.exec(M068)

  await nutzer(ANNA, 'verein', 'Anna')
  await nutzer(BERT, 'verein', 'Bert')
  await nutzer(DORA, 'gewerbe', 'Dora')
  await nutzer(VERW, 'verwaltung', 'Rathaus')
  await nutzer(LESER, 'buerger', 'Leser')

  tsv = (await db.query<{ id: string }>(
    `insert into public.vereine (profile_id, gemeinde_id, verein_name, typ) values ($1, $2, 'TSV', 'verein') returning id`, [ANNA, G1])).rows[0].id
  tafel = (await db.query<{ id: string }>(
    `insert into public.vereine (profile_id, gemeinde_id, verein_name, typ) values (null, $1, 'Tafel', 'organisation') returning id`, [G1])).rows[0].id
  baecker = (await db.query<{ id: string }>(
    `insert into public.organisationen (profile_id, gemeinde_id, name) values ($1, $2, 'Bäckerei') returning id`, [DORA, G1])).rows[0].id
  await db.query(`insert into public.vereine (gemeinde_id, verein_name, typ) values ($1, 'Fremd', 'verein')`, [G2])

  // TSV: zwei Autoren, ein Beitrag ohne Autor (Konto gelöscht), einer alt, einer nicht veröffentlicht
  await db.query(`insert into public.posts (author_id, org_id, channel) values ($1, $2, 'verein'), ($3, $2, 'verein')`, [ANNA, tsv, BERT])
  await db.query(`insert into public.posts (author_id, org_id, channel) values (null, $1, 'verein')`, [tsv])
  await db.query(`insert into public.posts (author_id, org_id, channel, published_at) values ($1, $2, 'verein', now() - interval '20 days')`, [ANNA, tsv])
  await db.query(`insert into public.posts (author_id, org_id, channel, status) values ($1, $2, 'verein', 'pending')`, [ANNA, tsv])
  await db.query(`insert into public.posts (author_id, org_id, channel) values ($1, $2, 'gewerbe')`, [DORA, baecker])
  await db.query(`insert into public.posts (author_id, channel) values ($1, 'gemeinde')`, [VERW])

  await db.query('insert into public.verein_abonnements (user_id, verein_id) values ($1, $2)', [LESER, tsv])
  await db.query('insert into public.verein_abonnements (user_id, verein_id) values ($1, $2)', [LESER, tafel])
  await db.query('insert into public.gewerbe_abonnements (user_id, gewerbe_id) values ($1, $2)', [LESER, baecker])
})

describe('superadmin_produzentenaccounts', () => {
  it('Vereine: eine Zeile pro Verein, Beiträge über org_id, auch ohne Autor', async () => {
    expect(await abfrage('verein')).toEqual([
      { id: tsv, name: 'TSV', posts_7d: 3, posts_30d: 4, subscribers: 1, is_active: true },
    ])
  })

  it('Organisationen: aus vereine, mit Abonnenten, auch ohne Mitglieder', async () => {
    expect(await abfrage('organisation')).toEqual([
      { id: tafel, name: 'Tafel', posts_7d: 0, posts_30d: 0, subscribers: 1, is_active: false },
    ])
  })

  it('Gewerbe: eine Zeile pro Betrieb', async () => {
    expect(await abfrage('gewerbe')).toEqual([
      { id: baecker, name: 'Bäckerei', posts_7d: 1, posts_30d: 1, subscribers: 1, is_active: true },
    ])
  })

  it('Verwaltung bleibt pro Person, ohne Abonnenten', async () => {
    expect(await abfrage('verwaltung')).toEqual([
      { id: VERW, name: 'Rathaus', posts_7d: 1, posts_30d: 1, subscribers: null, is_active: true },
    ])
  })

  it('ohne Gemeinde: alle Gemeinden', async () => {
    expect((await abfrage('verein', null)).map(z => z.name).sort()).toEqual(['Fremd', 'TSV'])
  })

  it('andere Rollen bleiben pro Person wie bisher', async () => {
    expect(await abfrage('buerger')).toEqual([{ id: LESER, name: 'Leser', posts_7d: 0, posts_30d: 0, subscribers: null, is_active: false }])
  })

  it('nur service_role darf ausführen', async () => {
    for (const r of ['anon', 'authenticated']) {
      const res = await db.query<{ ok: boolean }>(
        `select has_function_privilege('${r}', 'public.superadmin_produzentenaccounts(text, uuid)', 'execute') as ok`)
      expect(res.rows[0].ok).toBe(false)
    }
  })
})
