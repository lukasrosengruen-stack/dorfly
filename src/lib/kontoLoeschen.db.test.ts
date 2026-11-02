/**
 * Datenbanktest für Migration 064 (konto_loeschen, konto_dateipfade).
 *
 * Läuft gegen echtes Postgres (PGlite, WASM) — ohne Docker und ohne Supabase-CLI.
 * Das Schema unten bildet nur die Tabellen und Fremdschlüssel nach, die die
 * Löschung berührt, mit denselben Constraint-Namen und Cascade-Regeln wie in
 * Produktion. Darauf wird die echte Migrationsdatei ausgeführt.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { BASIS_SCHEMA, migration } from './testing/pgliteSchema'

const MIGRATION = migration('064_konto_loeschen.sql') + '\n' + migration('065_mitgliedschaften.sql')

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
  await db.exec(BASIS_SCHEMA)
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

describe('konto_loeschen — Vereinsmitglied', () => {
  const MITGLIED = '00000000-0000-0000-0000-00000000000d'
  let verein: string

  beforeEach(async () => {
    await nutzer(MITGLIED, 'mitglied@example.de', 'verein')
    verein = (await db.query<{ id: string }>(
      'insert into public.vereine (profile_id, logo_url) values ($1, $2) returning id', [MITGLIED, `${URL}vereine/logo.jpg`])).rows[0].id
    await db.query(`insert into public.mitgliedschaften (profile_id, verein_id, rolle) values ($1, $2, 'verwalter')`, [MITGLIED, verein])
    await db.query(`insert into public.posts (author_id, org_id, channel, bild_url) values ($1, $2, 'verein', $3)`, [MITGLIED, verein, `${URL}posts/verein.jpg`])
    await db.query(`insert into public.posts (author_id, channel, bild_url) values ($1, 'gemeinde', $2)`, [MITGLIED, `${URL}posts/eigen.jpg`])
    await db.query('insert into public.verein_abonnements (user_id, verein_id) values ($1, $2)', [ANDERER, verein])
  })

  it('lässt Verein, Abonnenten und Vereinsbeiträge stehen — ohne Autor', async () => {
    await loeschen(MITGLIED)
    expect(await anzahl('public.vereine where id = $1', [verein])).toBe(1)
    expect(await anzahl('public.verein_abonnements')).toBe(1)
    expect(await anzahl('public.posts where org_id = $1 and author_id is null', [verein])).toBe(1)
    expect(await anzahl(`public.posts where channel = 'gemeinde'`)).toBe(0)
    expect(await anzahl('public.mitgliedschaften')).toBe(0)
  })

  it('liefert keine Vereinsdateien als Löschpfade', async () => {
    const res = await db.query<{ pfad: string }>('select public.konto_dateipfade($1) as pfad', [MITGLIED])
    expect(res.rows.map(r => r.pfad)).toEqual(['posts/eigen.jpg'])
  })
})

describe('konto_dateipfade — fremde Dateien', () => {
  async function pfade(id: string) {
    const res = await db.query<{ pfad: string }>('select public.konto_dateipfade($1) as pfad', [id])
    return res.rows.map(r => r.pfad)
  }

  beforeEach(async () => {
    await nutzer(BUERGER, 'buerger@example.de')
  })

  it('liefert Pfade nicht, die ein bleibender Beitrag der Verwaltung ebenfalls nutzt', async () => {
    await nutzer(VERWALTUNG, 'verwaltung@example.de', 'verwaltung')
    await db.query('insert into public.posts (author_id, bild_url) values ($1, $2)', [VERWALTUNG, `${URL}posts/geteilt.jpg`])
    await db.query('insert into public.posts (author_id, bild_url) values ($1, $2)', [ANDERER, `${URL}posts/geteilt.jpg`])
    await db.query('insert into public.posts (author_id, bild_url) values ($1, $2)', [BUERGER, `${URL}posts/geteilt.jpg`])
    expect(await pfade(BUERGER)).toEqual([])
  })

  it('liefert das Gemeindelogo nicht, auch wenn Avatar oder Beitragsbild darauf zeigen', async () => {
    await db.query('insert into public.gemeinden (logo_url) values ($1)', [`${URL}gemeinden/g1/logo.png`])
    await db.query('update public.profiles set avatar_url = $2 where id = $1', [BUERGER, `${URL}gemeinden/g1/logo.png`])
    await db.query('insert into public.posts (author_id, bild_url) values ($1, $2)', [BUERGER, `${URL}gemeinden/g1/logo.png`])
    expect(await pfade(BUERGER)).toEqual([])
  })

  it('liefert das Logo eines anderen Vereins nicht', async () => {
    const v = await db.query<{ id: string }>(
      'insert into public.vereine (profile_id, logo_url) values ($1, $2) returning id', [ANDERER, `${URL}vereine/fremd/logo.jpg`])
    const pfad = `vereine/${v.rows[0].id}/logo.jpg`
    await db.query('update public.vereine set logo_url = $2 where id = $1', [v.rows[0].id, `${URL}${pfad}`])
    await db.query('insert into public.posts (author_id, bild_url) values ($1, $2)', [BUERGER, `${URL}${pfad}`])
    expect(await pfade(BUERGER)).toEqual([])
  })

  it('liefert keine Pfade mit .. oder ?', async () => {
    await db.query('insert into public.posts (author_id, bild_url) values ($1, $2)', [BUERGER, `${URL}posts/../x.png`])
    await db.query('insert into public.posts (author_id, bild_url) values ($1, $2)', [BUERGER, `${URL}posts/a.jpg?x=1`])
    expect(await pfade(BUERGER)).toEqual([])
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
  it('liefert referenzierte Bilder und eigene Ordner, aber nie gemeinden/ und nie Vereinsdateien', async () => {
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
