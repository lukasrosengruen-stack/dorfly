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

describe('mitglied_hinzufuegen / _entfernen / _rolle_aendern', () => {
  let verein: string

  async function hinzufuegen(profil: string, rolleText: string, akteur: string, ziel = verein) {
    await db.query('select public.mitglied_hinzufuegen($1, $2, $3, $4)', [profil, rolleText, akteur, ziel])
  }
  async function entfernen(profil: string, akteur: string) {
    await db.query('select public.mitglied_entfernen($1, $2)', [profil, akteur])
  }
  async function rolleAendern(profil: string, neu: string, akteur: string) {
    await db.query('select public.mitglied_rolle_aendern($1, $2, $3)', [profil, neu, akteur])
  }

  beforeEach(async () => {
    await neueDb(async () => {
      await nutzer(ANNA, 'anna@example.de', 'verein')
      verein = (await db.query<{ id: string }>(
        `insert into public.vereine (profile_id, gemeinde_id) values ($1, $2) returning id`, [ANNA, G1])).rows[0].id
    })
    await nutzer(BERT, 'bert@example.de')
    await nutzer(CARL, 'carl@example.de')
    await nutzer(RAT, 'rat@example.de', 'gemeinderat')
    await nutzer(FREMD, 'fremd@example.de', 'buerger', G2)
  })

  it('Verwalterin fügt einen Bürger als Autor hinzu und setzt seine Rolle', async () => {
    await hinzufuegen(BERT, 'autor', ANNA)
    expect(await rolle(BERT)).toBe('verein')
    expect(await wert<string>('select rolle from public.mitgliedschaften where profile_id = $1', [BERT])).toBe('autor')
    expect(await wert<string>(`select aktion from public.rollen_log where ziel_profile_id = $1`, [BERT])).toBe('mitglied_hinzugefuegt')
  })

  it('setzt bei Organisationen die Rolle organisation', async () => {
    await db.query(`update public.vereine set typ = 'organisation' where id = $1`, [verein])
    await hinzufuegen(BERT, 'autor', ANNA)
    expect(await rolle(BERT)).toBe('organisation')
  })

  it('lehnt Personen mit anderer Rolle ab', async () => {
    await expect(hinzufuegen(RAT, 'autor', ANNA)).rejects.toThrow(/bereits einem Verein zugeordnet oder hat eine andere Rolle/)
    expect(await rolle(RAT)).toBe('gemeinderat')
  })

  it('lehnt Mitglieder eines anderen Vereins ab', async () => {
    await nutzer(DORA, 'dora@example.de', 'gewerbe')
    const gewerbe = (await db.query<{ id: string }>(
      `insert into public.organisationen (profile_id, gemeinde_id) values ($1, $2) returning id`, [DORA, G1])).rows[0].id
    await db.query(`insert into public.mitgliedschaften (profile_id, organisation_id, rolle) values ($1, $2, 'verwalter')`, [DORA, gewerbe])
    await expect(hinzufuegen(DORA, 'autor', ANNA)).rejects.toThrow(/bereits einem Verein zugeordnet/)
  })

  it('lehnt Personen aus einer anderen Gemeinde ab', async () => {
    await expect(hinzufuegen(FREMD, 'autor', ANNA)).rejects.toThrow(/nicht zu dieser Gemeinde/)
  })

  it('verweigert Autoren, Fremden und der Verwaltung einer anderen Gemeinde das Hinzufügen', async () => {
    await hinzufuegen(BERT, 'autor', ANNA)
    await expect(hinzufuegen(CARL, 'autor', BERT)).rejects.toThrow(/Keine Berechtigung/)
    await expect(hinzufuegen(CARL, 'autor', RAT)).rejects.toThrow(/Keine Berechtigung/)
    await expect(hinzufuegen(CARL, 'autor', VERWALTUNG_G2)).rejects.toThrow(/Keine Berechtigung/)
  })

  it('erlaubt der Verwaltung der Gemeinde das Hinzufügen', async () => {
    await hinzufuegen(BERT, 'verwalter', VERWALTUNG)
    expect(await rolle(BERT)).toBe('verein')
  })

  it('entfernt ein Mitglied und setzt es auf buerger zurück', async () => {
    await hinzufuegen(BERT, 'autor', ANNA)
    await entfernen(BERT, ANNA)
    expect(await rolle(BERT)).toBe('buerger')
    expect(await wert<number>('select count(*)::int from public.mitgliedschaften where profile_id = $1', [BERT])).toBe(0)
  })

  it('lässt jedes Mitglied selbst austreten', async () => {
    await hinzufuegen(BERT, 'autor', ANNA)
    await entfernen(BERT, BERT)
    expect(await rolle(BERT)).toBe('buerger')
  })

  it('schützt den letzten Verwalter vor Verwaltern, aber nicht vor der Verwaltung', async () => {
    await expect(entfernen(ANNA, ANNA)).rejects.toThrow(/letzte Verwalter/)
    await expect(rolleAendern(ANNA, 'autor', ANNA)).rejects.toThrow(/letzte Verwalter/)
    await entfernen(ANNA, VERWALTUNG)
    expect(await rolle(ANNA)).toBe('buerger')
    expect(await wert<number>('select count(*)::int from public.vereine')).toBe(1)
  })

  it('erlaubt die Übergabe: neue Verwalterin hinzufügen, dann austreten', async () => {
    await hinzufuegen(BERT, 'verwalter', ANNA)
    await entfernen(ANNA, ANNA)
    expect(await wert<string>('select rolle from public.mitgliedschaften where profile_id = $1', [BERT])).toBe('verwalter')
  })

  it('ändert die Mitgliedsrolle', async () => {
    await hinzufuegen(BERT, 'autor', ANNA)
    await rolleAendern(BERT, 'verwalter', ANNA)
    expect(await wert<string>('select rolle from public.mitgliedschaften where profile_id = $1', [BERT])).toBe('verwalter')
    await expect(rolleAendern(ANNA, 'autor', BERT)).resolves.toBeUndefined()
  })

  async function fremderVerwalter() {
    await nutzer(DORA, 'dora@example.de', 'verein')
    const anderer = (await db.query<{ id: string }>(
      `insert into public.vereine (profile_id, gemeinde_id) values ($1, $2) returning id`, [DORA, G1])).rows[0].id
    await db.query(`insert into public.mitgliedschaften (profile_id, verein_id, rolle) values ($1, $2, 'verwalter')`, [DORA, anderer])
  }

  it('verweigert Verwaltern eines anderen Vereins Entfernen und Rollenänderung', async () => {
    await hinzufuegen(BERT, 'autor', ANNA)
    await fremderVerwalter()
    await expect(entfernen(BERT, DORA)).rejects.toThrow(/Keine Berechtigung/)
    await expect(rolleAendern(BERT, 'verwalter', DORA)).rejects.toThrow(/Keine Berechtigung/)
  })

  it('verweigert Autoren das Entfernen anderer Mitglieder', async () => {
    await hinzufuegen(BERT, 'autor', ANNA)
    await hinzufuegen(CARL, 'autor', ANNA)
    await expect(entfernen(CARL, BERT)).rejects.toThrow(/Keine Berechtigung/)
  })

  it('verweigert der Verwaltung einer anderen Gemeinde Entfernen und Rollenänderung', async () => {
    await hinzufuegen(BERT, 'autor', ANNA)
    await expect(entfernen(BERT, VERWALTUNG_G2)).rejects.toThrow(/Keine Berechtigung/)
    await expect(rolleAendern(BERT, 'verwalter', VERWALTUNG_G2)).rejects.toThrow(/Keine Berechtigung/)
  })

  it('fügt über p_organisation_id zu einem Gewerbe hinzu und setzt die Rolle gewerbe', async () => {
    await nutzer(DORA, 'dora@example.de', 'gewerbe')
    const gewerbe = (await db.query<{ id: string }>(
      `insert into public.organisationen (profile_id, gemeinde_id) values ($1, $2) returning id`, [DORA, G1])).rows[0].id
    await db.query(`insert into public.mitgliedschaften (profile_id, organisation_id, rolle) values ($1, $2, 'verwalter')`, [DORA, gewerbe])
    await db.query('select public.mitglied_hinzufuegen($1,$2,$3,null,$4)', [BERT, 'autor', DORA, gewerbe])
    expect(await rolle(BERT)).toBe('gewerbe')
  })

  it('verlangt genau eine Ziel-ID', async () => {
    const gewerbeId = (await db.query<{ id: string }>(
      `insert into public.organisationen (gemeinde_id) values ($1) returning id`, [G1])).rows[0].id
    await expect(db.query('select public.mitglied_hinzufuegen($1,$2,$3,$4,$5)', [BERT, 'autor', ANNA, verein, gewerbeId]))
      .rejects.toThrow(/genau einen Verein/)
    await expect(db.query('select public.mitglied_hinzufuegen($1,$2,$3,null,null)', [BERT, 'autor', ANNA]))
      .rejects.toThrow(/genau einen Verein/)
  })

  it('lehnt unbekannte Mitgliedsrollen ab', async () => {
    await expect(hinzufuegen(BERT, 'admin', ANNA)).rejects.toThrow(/Unbekannte Mitgliedsrolle/)
    await hinzufuegen(BERT, 'autor', ANNA)
    await expect(rolleAendern(BERT, 'admin', ANNA)).rejects.toThrow(/Unbekannte Mitgliedsrolle/)
  })
})

describe('Rechte auf die Funktionen', () => {
  beforeEach(async () => { await neueDb() })

  it('nur service_role darf ausführen', async () => {
    for (const fn of [
      'mitglied_hinzufuegen(uuid, text, uuid, uuid, uuid)',
      'mitglied_entfernen(uuid, uuid)',
      'mitglied_rolle_aendern(uuid, text, uuid)',
    ]) {
      for (const r of ['anon', 'authenticated']) {
        expect(await wert<boolean>(`has_function_privilege('${r}', 'public.${fn}', 'execute')`)).toBe(false)
      }
      expect(await wert<boolean>(`has_function_privilege('service_role', 'public.${fn}', 'execute')`)).toBe(true)
    }
  })

  it('interne Hilfsfunktionen sind für niemanden außer dem Owner ausführbar', async () => {
    for (const fn of [
      '_vereinsziel(uuid, uuid)',
      '_mitglieder_recht(uuid, uuid, uuid, uuid)',
      '_rollen_log(uuid, text, uuid, text, text, uuid)',
      '_weiterer_verwalter(uuid, uuid, uuid)',
      '_mitglied_eintragen(uuid, uuid, uuid, text, uuid, boolean)',
    ]) {
      for (const r of ['anon', 'authenticated', 'service_role']) {
        expect(await wert<boolean>(`has_function_privilege('${r}', 'public.${fn}', 'execute')`)).toBe(false)
      }
    }
  })
})

describe('verein_anlegen', () => {
  beforeEach(async () => {
    await neueDb()
    await nutzer(BERT, 'bert@example.de')
    await nutzer(CARL, 'carl@example.de', 'verein')
    await nutzer(RAT, 'rat@example.de', 'gemeinderat')
  })

  async function anlegen(profil: string, typ: string, akteur: string) {
    return wert<string>('public.verein_anlegen($1, $2, $3, $4)', [profil, typ, 'Musikverein', akteur])
  }

  it('Selbstanlage: Person mit passender Rolle wird Verwalterin', async () => {
    const id = await anlegen(CARL, 'verein', CARL)
    expect(await wert<string>('select rolle from public.mitgliedschaften where profile_id = $1', [CARL])).toBe('verwalter')
    expect(await wert<string>('select verein_name from public.vereine where id = $1', [id])).toBe('Musikverein')
    expect(await wert<string>('select gemeinde_id from public.vereine where id = $1', [id])).toBe(G1)
  })

  it('Selbstanlage mit unpassender Rolle wird abgelehnt', async () => {
    await expect(anlegen(BERT, 'verein', BERT)).rejects.toThrow(/Keine Berechtigung/)
  })

  it('Verwaltung legt ein Gewerbe für einen Bürger an', async () => {
    const id = await anlegen(BERT, 'gewerbe', VERWALTUNG)
    expect(await rolle(BERT)).toBe('gewerbe')
    expect(await wert<string>('select organisation_id from public.mitgliedschaften where profile_id = $1', [BERT])).toBe(id)
  })

  it('Verwaltung darf eine Person mit anderer Rolle umstellen', async () => {
    await anlegen(RAT, 'organisation', VERWALTUNG)
    expect(await rolle(RAT)).toBe('organisation')
    expect(await wert<string>('select typ from public.vereine')).toBe('organisation')
  })

  it('zweiter Verein für dieselbe Person wird abgelehnt', async () => {
    await anlegen(CARL, 'verein', CARL)
    await expect(anlegen(CARL, 'verein', VERWALTUNG)).rejects.toThrow(/bereits einem Verein/)
  })

  it('Verwaltung einer anderen Gemeinde darf nicht', async () => {
    await expect(anlegen(BERT, 'verein', VERWALTUNG_G2)).rejects.toThrow(/Keine Berechtigung/)
  })

  it('verein_anlegen und einladung_einloesen sind nur für service_role ausführbar; _vereinszeile_anlegen für niemanden', async () => {
    for (const fn of ['verein_anlegen(uuid, text, text, uuid)', 'einladung_einloesen(uuid, uuid)']) {
      for (const r of ['anon', 'authenticated']) {
        expect(await wert<boolean>(`has_function_privilege('${r}', 'public.${fn}', 'execute')`)).toBe(false)
      }
      expect(await wert<boolean>(`has_function_privilege('service_role', 'public.${fn}', 'execute')`)).toBe(true)
    }
    for (const r of ['anon', 'authenticated', 'service_role']) {
      expect(await wert<boolean>(`has_function_privilege('${r}', 'public._vereinszeile_anlegen(text, uuid, text, uuid)', 'execute')`)).toBe(false)
    }
  })
})

describe('einladung_einloesen', () => {
  let verein: string

  beforeEach(async () => {
    await neueDb(async () => {
      await nutzer(ANNA, 'anna@example.de', 'verein')
      verein = (await db.query<{ id: string }>(
        `insert into public.vereine (profile_id, gemeinde_id, verein_name) values ($1, $2, 'TSV') returning id`, [ANNA, G1])).rows[0].id
    })
  })

  async function einladung(werte: Record<string, unknown>) {
    const spalten = Object.keys(werte)
    const res = await db.query<{ id: string }>(
      `insert into public.einladungen (${spalten.join(', ')}) values (${spalten.map((_, i) => `$${i + 1}`).join(', ')}) returning id`,
      Object.values(werte),
    )
    return res.rows[0].id
  }

  it('trägt in einen bestehenden Verein mit der eingeladenen Mitgliedsrolle ein', async () => {
    await nutzer(BERT, 'bert@example.de', 'verein')
    const id = await einladung({
      gemeinde_id: G1, email: 'bert@example.de', rolle: 'verein', verein_id: verein,
      mitglied_rolle: 'verwalter', status: 'angenommen', eingeladen_von: ANNA,
    })
    await db.query('select public.einladung_einloesen($1, $2)', [BERT, id])
    expect(await wert<string>('select rolle from public.mitgliedschaften where profile_id = $1', [BERT])).toBe('verwalter')
  })

  it('legt aus organisation_name einen neuen Verein an — Rolle organisation landet in vereine', async () => {
    await nutzer(BERT, 'bert@example.de', 'organisation')
    const id = await einladung({
      gemeinde_id: G1, email: 'bert@example.de', rolle: 'organisation', organisation_name: 'Tafel',
      status: 'angenommen', eingeladen_von: VERWALTUNG,
    })
    await db.query('select public.einladung_einloesen($1, $2)', [BERT, id])
    expect(await wert<string>(`select typ from public.vereine where verein_name = 'Tafel'`)).toBe('organisation')
    expect(await wert<string>('select rolle from public.mitgliedschaften where profile_id = $1', [BERT])).toBe('verwalter')
  })

  it('verweigert eine Einladung für eine andere E-Mail-Adresse', async () => {
    await nutzer(BERT, 'bert@example.de', 'verein')
    const id = await einladung({
      gemeinde_id: G1, email: 'jemand@example.de', rolle: 'verein', verein_id: verein,
      status: 'angenommen', eingeladen_von: ANNA,
    })
    await expect(db.query('select public.einladung_einloesen($1, $2)', [BERT, id])).rejects.toThrow(/andere E-Mail/)
  })

  it('ignoriert Einladungen ohne Vereinsrolle', async () => {
    await nutzer(BERT, 'bert@example.de')
    const id = await einladung({ gemeinde_id: G1, email: 'bert@example.de', rolle: 'buerger', status: 'angenommen', eingeladen_von: ANNA })
    await db.query('select public.einladung_einloesen($1, $2)', [BERT, id])
    expect(await wert<number>('select count(*)::int from public.mitgliedschaften where profile_id = $1', [BERT])).toBe(0)
  })
})
