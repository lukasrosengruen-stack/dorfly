/**
 * Datenbanktest für Migration 064 (konto_loeschen, konto_dateipfade).
 *
 * Läuft gegen echtes Postgres (PGlite, WASM) — ohne Docker und ohne Supabase-CLI.
 * Das Schema unten bildet nur die Tabellen und Fremdschlüssel nach, die die
 * Löschung berührt, mit denselben Constraint-Namen und Cascade-Regeln wie in
 * Produktion. Darauf wird die echte Migrationsdatei ausgeführt.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

const MIGRATION = readFileSync(
  path.resolve(__dirname, '../../supabase/migrations/064_konto_loeschen.sql'),
  'utf8',
)

const SCHEMA = `
  create role anon;
  create role authenticated;
  create role service_role;

  create schema auth;
  create table auth.users (id uuid primary key, email text);

  create schema storage;
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text not null,
    name text not null
  );

  create table public.gemeinden (id uuid primary key default gen_random_uuid());

  create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    role text not null default 'buerger',
    email text,
    avatar_url text
  );

  create table public.organisationen (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null references public.profiles(id),
    logo_url text
  );
  create table public.vereine (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null unique references public.profiles(id) on delete cascade,
    logo_url text
  );
  create table public.verein_abonnements (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    verein_id uuid not null references public.vereine(id) on delete cascade
  );
  create table public.gewerbe_abonnements (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    gewerbe_id uuid not null references public.organisationen(id) on delete cascade
  );

  create table public.posts (
    id uuid primary key default gen_random_uuid(),
    author_id uuid not null references public.profiles(id),
    bild_url text,
    bilder_urls text[]
  );
  create table public.maengel (
    id uuid primary key default gen_random_uuid(),
    melder_id uuid not null references public.profiles(id),
    foto_url text
  );
  create table public.fragen (
    id uuid primary key default gen_random_uuid(),
    fragesteller_id uuid not null references public.profiles(id),
    antwort text
  );
  create table public.gemeinderat_fragen (
    id uuid primary key default gen_random_uuid(),
    fragesteller_id uuid not null references public.profiles(id) on delete cascade,
    gemeinderat_id uuid not null references public.profiles(id) on delete cascade
  );

  create table public.umfragen (
    id uuid primary key default gen_random_uuid(),
    author_id uuid not null references public.profiles(id) on delete cascade,
    bilder_urls text[] not null default '{}'
  );
  create table public.umfrage_fragen (
    id uuid primary key default gen_random_uuid(),
    umfrage_id uuid not null references public.umfragen(id) on delete cascade,
    bilder_urls text[] not null default '{}'
  );
  create table public.umfrage_antworten (
    id uuid primary key default gen_random_uuid(),
    umfrage_id uuid not null references public.umfragen(id) on delete cascade,
    frage_id uuid not null references public.umfrage_fragen(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    antwort_text text
  );
  create table public.umfrage_teilnahmen (
    id uuid primary key default gen_random_uuid(),
    umfrage_id uuid not null references public.umfragen(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    unique (umfrage_id, user_id)
  );

  create table public.meldungen (
    id uuid primary key default gen_random_uuid(),
    melder_id uuid not null references auth.users(id) on delete cascade
  );
  create table public.abfallkalender_praeferenzen (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade
  );

  create table public.einladungen (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    status text not null default 'offen'
      check (status in ('offen', 'angenommen', 'abgelaufen', 'widerrufen')),
    eingeladen_von uuid not null references public.profiles(id)
  );
  create table public.rollen_log (
    id uuid primary key default gen_random_uuid(),
    ziel_profile_id uuid,
    ziel_email text not null,
    ausgefuehrt_von uuid not null
  );
`

const URL = 'https://xyz.supabase.co/storage/v1/object/public/dorfly-media/'

const BUERGER = '00000000-0000-0000-0000-00000000000b'
const VERWALTUNG = '00000000-0000-0000-0000-00000000000a'
const ANDERER = '00000000-0000-0000-0000-00000000000c'

let db: PGlite

async function nutzer(id: string, email: string, role = 'buerger') {
  await db.query('insert into auth.users (id, email) values ($1, $2)', [id, email])
  await db.query('insert into public.profiles (id, role, email) values ($1, $2, $3)', [id, role, email])
}

async function anzahl(sql: string, params: unknown[] = []): Promise<number> {
  const res = await db.query<{ n: number }>(`select count(*)::int as n from ${sql}`, params)
  return res.rows[0].n
}

async function loeschen(id: string) {
  await db.query('select public.konto_loeschen($1)', [id])
}

/** Umfrage des anderen Nutzers, an der `teilnehmer` teilgenommen hat. */
async function umfrageMitStimme(teilnehmer: string) {
  const u = await db.query<{ id: string }>('insert into public.umfragen (author_id) values ($1) returning id', [ANDERER])
  const f = await db.query<{ id: string }>('insert into public.umfrage_fragen (umfrage_id) values ($1) returning id', [u.rows[0].id])
  await db.query(
    'insert into public.umfrage_antworten (umfrage_id, frage_id, user_id, antwort_text) values ($1, $2, $3, $4)',
    [u.rows[0].id, f.rows[0].id, teilnehmer, 'ja'],
  )
  await db.query('insert into public.umfrage_teilnahmen (umfrage_id, user_id) values ($1, $2)', [u.rows[0].id, teilnehmer])
  return u.rows[0].id
}

beforeEach(async () => {
  db = new PGlite()
  await db.exec(SCHEMA)
  await db.exec(MIGRATION)
  await nutzer(ANDERER, 'andere@example.de')
})

describe('konto_loeschen — Bürgerkonto', () => {
  beforeEach(async () => {
    await nutzer(BUERGER, 'Buerger@Example.de')
    await db.query('insert into public.maengel (melder_id, foto_url) values ($1, $2)', [BUERGER, `${URL}maengel/1.jpg`])
    await db.query('insert into public.fragen (fragesteller_id, antwort) values ($1, $2)', [BUERGER, 'Antwort der Verwaltung'])
    await db.query('insert into public.gemeinderat_fragen (fragesteller_id, gemeinderat_id) values ($1, $2)', [BUERGER, ANDERER])
    await db.query('insert into public.meldungen (melder_id) values ($1)', [BUERGER])
    await db.query('insert into public.abfallkalender_praeferenzen (user_id) values ($1)', [BUERGER])
    const v = await db.query<{ id: string }>('insert into public.vereine (profile_id) values ($1) returning id', [ANDERER])
    await db.query('insert into public.verein_abonnements (user_id, verein_id) values ($1, $2)', [BUERGER, v.rows[0].id])
    const o = await db.query<{ id: string }>('insert into public.organisationen (profile_id) values ($1) returning id', [ANDERER])
    await db.query('insert into public.gewerbe_abonnements (user_id, gewerbe_id) values ($1, $2)', [BUERGER, o.rows[0].id])
  })

  it('löscht Konto, Profil und alle eigenen Inhalte', async () => {
    await loeschen(BUERGER)

    expect(await anzahl('auth.users where id = $1', [BUERGER])).toBe(0)
    expect(await anzahl('public.profiles where id = $1', [BUERGER])).toBe(0)
    expect(await anzahl('public.maengel')).toBe(0)
    expect(await anzahl('public.fragen')).toBe(0)
    expect(await anzahl('public.gemeinderat_fragen')).toBe(0)
    expect(await anzahl('public.meldungen')).toBe(0)
    expect(await anzahl('public.abfallkalender_praeferenzen')).toBe(0)
    expect(await anzahl('public.verein_abonnements')).toBe(0)
    expect(await anzahl('public.gewerbe_abonnements')).toBe(0)
  })

  it('lässt andere Konten unberührt', async () => {
    await loeschen(BUERGER)
    expect(await anzahl('auth.users where id = $1', [ANDERER])).toBe(1)
    expect(await anzahl('public.vereine')).toBe(1)
    expect(await anzahl('public.organisationen')).toBe(1)
  })

  it('anonymisiert Umfrageantworten, statt sie zu löschen', async () => {
    const umfrage = await umfrageMitStimme(BUERGER)
    await loeschen(BUERGER)

    const antworten = await db.query<{ user_id: string | null; antwort_text: string }>(
      'select user_id, antwort_text from public.umfrage_antworten where umfrage_id = $1', [umfrage],
    )
    expect(antworten.rows).toEqual([{ user_id: null, antwort_text: 'ja' }])
    expect(await anzahl('public.umfrage_teilnahmen where umfrage_id = $1 and user_id is null', [umfrage])).toBe(1)
  })

  it('ersetzt die E-Mail-Adresse in rollen_log und einladungen, Groß-/Kleinschreibung egal', async () => {
    await db.query(
      `insert into public.rollen_log (ziel_profile_id, ziel_email, ausgefuehrt_von)
       values ($1, 'buerger@example.de', $2), (null, 'BUERGER@example.de', $2), (null, 'andere@example.de', $2)`,
      [BUERGER, ANDERER],
    )
    await db.query(
      `insert into public.einladungen (email, status, eingeladen_von)
       values ('buerger@example.de', 'offen', $1), ('buerger@example.de', 'angenommen', $1), ('andere@example.de', 'offen', $1)`,
      [ANDERER],
    )

    await loeschen(BUERGER)

    const log = await db.query<{ ziel_email: string; ziel_profile_id: string | null }>(
      'select ziel_email, ziel_profile_id from public.rollen_log order by ziel_email',
    )
    expect(log.rows).toEqual([
      { ziel_email: 'andere@example.de', ziel_profile_id: null },
      { ziel_email: 'geloeschtes-konto', ziel_profile_id: null },
      { ziel_email: 'geloeschtes-konto', ziel_profile_id: null },
    ])

    const einl = await db.query<{ email: string; status: string }>(
      'select email, status from public.einladungen order by email, status',
    )
    expect(einl.rows).toEqual([
      { email: 'andere@example.de', status: 'offen' },
      { email: 'geloeschtes-konto', status: 'angenommen' },
      { email: 'geloeschtes-konto', status: 'widerrufen' },
    ])
  })

  it('wirft bei einem unbekannten Konto', async () => {
    await expect(loeschen('99999999-9999-9999-9999-999999999999')).rejects.toThrow(/nicht gefunden/)
  })
})

describe('konto_loeschen — Verwaltungskonto mit verschickten Einladungen', () => {
  beforeEach(async () => {
    await nutzer(VERWALTUNG, 'verwaltung@gemeinde.de', 'verwaltung')
    await db.query(
      `insert into public.einladungen (email, status, eingeladen_von)
       values ('neu1@example.de', 'offen', $1), ('neu2@example.de', 'angenommen', $1)`,
      [VERWALTUNG],
    )
    await db.query('insert into public.posts (author_id, bild_url) values ($1, $2)', [VERWALTUNG, `${URL}posts/a.jpg`])
    await db.query('insert into public.umfragen (author_id) values ($1)', [VERWALTUNG])
    await db.query(
      `insert into public.rollen_log (ziel_profile_id, ziel_email, ausgefuehrt_von) values (null, 'neu1@example.de', $1)`,
      [VERWALTUNG],
    )
  })

  it('löscht das Konto, obwohl es Einladungen verschickt hat', async () => {
    await loeschen(VERWALTUNG)
    expect(await anzahl('auth.users where id = $1', [VERWALTUNG])).toBe(0)
    expect(await anzahl('public.profiles where id = $1', [VERWALTUNG])).toBe(0)
  })

  it('behält die Einladungen, ohne Bezug zum gelöschten Konto', async () => {
    await loeschen(VERWALTUNG)
    const einl = await db.query<{ email: string; status: string; eingeladen_von: string | null }>(
      'select email, status, eingeladen_von from public.einladungen order by email',
    )
    expect(einl.rows).toEqual([
      { email: 'neu1@example.de', status: 'offen', eingeladen_von: null },
      { email: 'neu2@example.de', status: 'angenommen', eingeladen_von: null },
    ])
  })

  it('löscht Beiträge und Umfragen der Verwaltung', async () => {
    await loeschen(VERWALTUNG)
    expect(await anzahl('public.posts')).toBe(0)
    expect(await anzahl('public.umfragen where author_id = $1', [VERWALTUNG])).toBe(0)
  })

  it('lässt Protokolleinträge über Dritte stehen', async () => {
    await loeschen(VERWALTUNG)
    expect(await anzahl(`public.rollen_log where ziel_email = 'neu1@example.de'`)).toBe(1)
  })
})

describe('konto_loeschen — ganz oder gar nicht', () => {
  it('rollt alles zurück, wenn ein Schritt scheitert', async () => {
    await nutzer(BUERGER, 'buerger@example.de')
    const umfrage = await umfrageMitStimme(BUERGER)
    await db.query('insert into public.maengel (melder_id) values ($1)', [BUERGER])
    await db.query(
      `insert into public.rollen_log (ziel_profile_id, ziel_email, ausgefuehrt_von) values ($1, 'buerger@example.de', $2)`,
      [BUERGER, ANDERER],
    )
    // Eine Tabelle, die die Funktion nicht kennt, blockiert das Löschen des Profils
    await db.exec(`
      create table public.unbekannt (id serial primary key, profile_id uuid not null references public.profiles(id));
      insert into public.unbekannt (profile_id) values ('${BUERGER}');
    `)

    await expect(loeschen(BUERGER)).rejects.toThrow(/foreign key/)

    expect(await anzahl('auth.users where id = $1', [BUERGER])).toBe(1)
    expect(await anzahl('public.profiles where id = $1', [BUERGER])).toBe(1)
    expect(await anzahl('public.maengel')).toBe(1)
    expect(await anzahl('public.umfrage_antworten where umfrage_id = $1 and user_id = $2', [umfrage, BUERGER])).toBe(1)
    expect(await anzahl(`public.rollen_log where ziel_email = 'buerger@example.de'`)).toBe(1)
  })
})

describe('konto_dateipfade', () => {
  it('liefert referenzierte Bilder und eigene Ordner, aber nie gemeinden/', async () => {
    await nutzer(BUERGER, 'buerger@example.de', 'verein')
    await db.query('update public.profiles set avatar_url = $2 where id = $1', [BUERGER, `${URL}gemeinderat/${BUERGER}/avatar_2.jpg`])
    await db.query('insert into public.maengel (melder_id, foto_url) values ($1, $2)', [BUERGER, `${URL}maengel/1.jpg`])
    await db.query('insert into public.maengel (melder_id, foto_url) values ($1, null)', [BUERGER])
    await db.query(
      'insert into public.posts (author_id, bild_url, bilder_urls) values ($1, $2, $3)',
      [BUERGER, `${URL}posts/titel.jpg`, [`${URL}posts/galerie1.jpg`, `${URL}posts/galerie2.jpg`]],
    )
    await db.query('insert into public.posts (author_id, bild_url) values ($1, $2)', [BUERGER, 'https://extern.example/bild.jpg'])
    const v = await db.query<{ id: string }>(
      'insert into public.vereine (profile_id, logo_url) values ($1, $2) returning id', [BUERGER, `${URL}vereine/x/logo_2.jpg`],
    )
    const vereinId = v.rows[0].id
    const u = await db.query<{ id: string }>(
      'insert into public.umfragen (author_id, bilder_urls) values ($1, $2) returning id',
      [BUERGER, [`${URL}umfragen/tmp/${BUERGER}/kopf.jpg`]],
    )
    await db.query('insert into public.umfrage_fragen (umfrage_id, bilder_urls) values ($1, $2)', [u.rows[0].id, [`${URL}umfragen/${u.rows[0].id}/frage.jpg`]])

    await db.query(
      `insert into storage.objects (bucket_id, name) values
        ('dorfly-media', 'gemeinderat/${BUERGER}/avatar_1.jpg'),
        ('dorfly-media', 'vereine/${vereinId}/logo_alt.jpg'),
        ('dorfly-media', 'umfragen/tmp/${BUERGER}/verwaist.jpg'),
        ('dorfly-media', 'gemeinden/g1/logo.png'),
        ('dorfly-media', 'gemeinderat/${ANDERER}/avatar.jpg'),
        ('anderer-bucket', 'gemeinderat/${BUERGER}/x.jpg')`,
    )

    const res = await db.query<{ pfad: string }>('select public.konto_dateipfade($1) as pfad', [BUERGER])
    const pfade = res.rows.map(r => r.pfad).sort()

    expect(pfade).toEqual([
      `gemeinderat/${BUERGER}/avatar_1.jpg`,
      `gemeinderat/${BUERGER}/avatar_2.jpg`,
      'maengel/1.jpg',
      'posts/galerie1.jpg',
      'posts/galerie2.jpg',
      'posts/titel.jpg',
      `umfragen/${u.rows[0].id}/frage.jpg`,
      `umfragen/tmp/${BUERGER}/kopf.jpg`,
      `umfragen/tmp/${BUERGER}/verwaist.jpg`,
      `vereine/${vereinId}/logo_alt.jpg`,
      'vereine/x/logo_2.jpg',
    ].sort())
  })
})

describe('Rechte', () => {
  it('nur service_role darf die Funktionen ausführen', async () => {
    await nutzer(BUERGER, 'buerger@example.de')
    for (const rolle of ['anon', 'authenticated']) {
      await db.exec(`set role ${rolle}`)
      await expect(loeschen(BUERGER)).rejects.toThrow(/permission denied/)
      await expect(db.query('select public.konto_dateipfade($1)', [BUERGER])).rejects.toThrow(/permission denied/)
      await db.exec('reset role')
    }
    const rechte = await db.query<{ ok: boolean }>(
      `select has_function_privilege('service_role', 'public.konto_loeschen(uuid)', 'execute') as ok`,
    )
    expect(rechte.rows[0].ok).toBe(true)
  })
})
