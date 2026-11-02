# Mehrere Autoren und Verwalter pro Verein — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Verein, eine Organisation oder ein Gewerbe kann mehrere Mitglieder (Verwalter, Autoren) haben. Wechsel der Verantwortlichen und Kontolöschungen gefährden den Verein nicht mehr.

**Architecture:** Neue Tabelle `public.mitgliedschaften` (eine Zeile pro Person, `profile_id` ist Primärschlüssel). Alle Änderungen an Mitgliedschaft und `profiles.role` laufen über `security definer`-Funktionen in einer Transaktion, die auch die Berechtigung prüfen. API-Routen rufen diese Funktionen über den Service-Client auf; Rechte in den bestehenden Verein-/Gewerbe-Routen hängen an der Mitgliedschaft statt an `profile_id`.

**Tech Stack:** Next.js 16, React 19, Supabase (Postgres, PostgREST), Zod, react-hook-form, Vitest, PGlite (Datenbanktests)

**Spec:** [docs/superpowers/specs/2026-11-02-vereins-mitglieder-design.md](../specs/2026-11-02-vereins-mitglieder-design.md)

---

## Reihenfolge beim Ausrollen

1. **Task 1** (Bestandsdaten prüfen) — Mensch, im Supabase-SQL-Editor.
2. **Task 2–7** lokal, mit PGlite-Tests.
3. **Task 8** — Mensch spielt **065** im SQL-Editor ein, danach `npm run db:types`. 065 ist rückwärtskompatibel, der alte Code läuft weiter.
4. **Task 9–26** Code und Migration 066 (nur geschrieben und getestet, noch nicht eingespielt).
5. **Task 27** Gesamtprüfung, dann Deploy.
6. Nach dem Deploy spielt der Mensch **066** ein (Task 27, Step 4).

## Dateistruktur

| Datei | Verantwortung |
|---|---|
| `supabase/migrations/065_mitgliedschaften.sql` (neu) | Tabelle, Backfill, Funktionen, neue `konto_loeschen` |
| `supabase/migrations/066_mitgliedschaften_abschluss.sql` (neu) | Nachzügler-Backfill, Schreibrechte entziehen |
| `src/lib/testing/pgliteSchema.ts` (neu) | gemeinsames Testschema für PGlite-Datenbanktests |
| `src/lib/mitgliedschaften.db.test.ts` (neu) | Datenbanktests für 065/066 |
| `src/lib/kontoLoeschen.db.test.ts` | auf gemeinsames Schema + neues Verhalten umstellen |
| `src/lib/mitgliedschaft.ts` (neu) | Typen, `meineMitgliedschaft`, `meinVereinsziel`, `bestimmeZiel`, `ladeTeam`, `rpcFehler`, `vereinsEintraege`, `kurzname` |
| `src/lib/mitgliedschaft.test.ts` (neu) | Unit-Tests der reinen Funktionen |
| `src/lib/mitgliedHinzufuegen.ts` (neu) | Ablauf „per E-Mail hinzufügen oder einladen“ |
| `src/lib/mitgliedHinzufuegen.test.ts` (neu) | Unit-Tests |
| `src/lib/vereinLoeschen.ts` (neu) | Ablauf „Dateien → Datenbank“ beim Löschen eines Vereins |
| `src/lib/vereinLoeschen.test.ts` (neu) | Unit-Tests |
| `src/lib/kontoLoeschen.ts` | `entferneDateien` exportieren (gemeinsam genutzt) |
| `src/lib/absender.ts` (neu) + Test | Vereinsname als Absender über `posts.org_id` |
| `src/lib/email.ts` | `absender`/`zusatz` in drei Mail-Vorlagen |
| `src/lib/validations.ts` | Zod-Schemas für Mitglieder-Routen; Transfer-Felder entfernen |
| `src/app/api/mitglieder/route.ts` (neu) | GET/POST/PATCH/DELETE Mitglieder |
| `src/app/api/mitglieder/einladung/route.ts` (neu) | Einladung zurückziehen |
| `src/app/api/mitglieder/verein/route.ts` (neu) | Verein/Gewerbe löschen |
| `src/app/api/verein/post/route.ts`, `src/app/api/verein/profil/route.ts` | Rechte über Mitgliedschaft |
| `src/app/api/gewerbe/post/route.ts`, `.../profil/route.ts`, `.../betrieb/route.ts` | Rechte über Mitgliedschaft |
| `src/app/api/verwaltung/nutzer/rolle/route.ts` | Transfer entfernen, Funktionen nutzen |
| `src/lib/profil-anlegen.ts` | `einladung_einloesen` |
| `src/components/dashboard/MitgliederSection.tsx` (neu) | Bereich „Team“ inkl. Gefahrenbereich |
| `src/components/dashboard/VereineVerwaltungSection.tsx` (neu) | Verwaltung: Liste mit Akkordeon |
| `src/app/(admin)/dashboard/page.tsx`, `src/components/dashboard/VereinPostVerwaltung.tsx` | Vereins-Dashboard + Verwaltungsliste |
| `src/app/(app)/gewerbe/dashboard/page.tsx`, `GewerbeDashboardClient.tsx` | Gewerbe-Dashboard |
| Feed, Kalender, Share-Seite, `publicPostQuery.ts` | Absender über `org_id` |
| `src/app/konto-loeschen/page.tsx`, `src/app/datenschutz/page.tsx` | Texte |

**Konvention für RPC-Parameter:** Optionale Ziel-Parameter (`p_verein_id`, `p_organisation_id`) haben in SQL `default null`. Nur so erzeugt `npm run db:types` sie als optional (`p_verein_id?: string`). Im TypeScript wird `undefined` übergeben, nie `null`.

---

### Task 1: Bestandsdaten prüfen (Mensch, Supabase-SQL-Editor)

**Files:** keine

- [ ] **Step 1: Abfragen im SQL-Editor ausführen**

```sql
-- a) Personen, die mehreren Vereinen/Gewerben zugeordnet sind (muss 0 Zeilen liefern)
select profile_id, count(*)
from (
  select profile_id from public.vereine where profile_id is not null
  union all
  select profile_id from public.organisationen where profile_id is not null
) x
group by profile_id having count(*) > 1;

-- b) Typen in organisationen (erwartet: nur 'gewerbe')
select typ, count(*) from public.organisationen group by typ;

-- c) Verwendete Aktionen im Rollen-Protokoll (erwartet: Teilmenge von
--    eingeladen, rolle_gesetzt, rolle_transfer, widerrufen)
select aktion, count(*) from public.rollen_log group by aktion;

-- d) Name der Check-Constraint auf rollen_log.aktion
select conname, pg_get_constraintdef(oid)
from pg_constraint where conrelid = 'public.rollen_log'::regclass and contype = 'c';
```

- [ ] **Step 2: Ergebnis bewerten**

- a) liefert Zeilen → mit dem Nutzer klären, welche Zuordnung bleibt. Die übrigen `profile_id` auf `null` setzen, bevor 065 läuft. 065 bricht sonst mit Fehlermeldung ab.
- b) enthält andere Typen als `gewerbe` → diese Zeilen sind Altlasten. 065 behandelt alle `organisationen` wie Gewerbe (Rolle `gewerbe`). Mit dem Nutzer klären, ob sie gelöscht werden.
- c) enthält andere Werte → in Task 3 Step 3 zur Liste der erlaubten Aktionen hinzufügen.

---

### Task 2: Gemeinsames PGlite-Testschema

Der bestehende Datenbanktest bildet das Schema inline nach. Beide Tests (Kontolöschung und Mitgliedschaften) brauchen jetzt dieselben Tabellen, also wird es ausgelagert und erweitert. Das Verhalten der bestehenden Tests ändert sich in diesem Task nicht.

**Files:**
- Create: `src/lib/testing/pgliteSchema.ts`
- Modify: `src/lib/kontoLoeschen.db.test.ts:15-133`

- [ ] **Step 1: Schema-Datei anlegen**

```ts
/**
 * Gemeinsames Schema für Datenbanktests mit PGlite (echtes Postgres als WASM).
 *
 * Bildet nur die Tabellen, Spalten und Fremdschlüssel nach, die die getesteten
 * Migrationen berühren — mit denselben Constraint-Namen und Cascade-Regeln wie in
 * Produktion. Darauf werden die echten Migrationsdateien ausgeführt.
 *
 * Abweichungen von Produktion, damit Tests knapp bleiben:
 *   * gemeinde_id ist überall nullable,
 *   * rollen_log.aktion hat einen Default,
 *   * Namensspalten haben Defaults.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'

export function migration(datei: string): string {
  return readFileSync(path.resolve(__dirname, '../../../supabase/migrations', datei), 'utf8')
}

export const BASIS_SCHEMA = `
  create role anon;
  create role authenticated;
  create role service_role;

  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;

  create schema storage;
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text not null,
    name text not null
  );

  create type public.user_role as enum
    ('buerger', 'organisation', 'verwaltung', 'super_admin', 'gewerbe', 'gemeinderat', 'verein');
  create type public.org_type as enum ('verein', 'gewerbe', 'institution');
  create type public.post_channel as enum ('gemeinde', 'verein', 'gewerbe', 'gemeinderat');

  create table public.gemeinden (id uuid primary key default gen_random_uuid());

  create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    gemeinde_id uuid references public.gemeinden(id),
    role public.user_role not null default 'buerger',
    email text,
    display_name text,
    vorname text,
    nachname text,
    avatar_url text
  );

  create table public.organisationen (
    id uuid primary key default gen_random_uuid(),
    gemeinde_id uuid references public.gemeinden(id),
    profile_id uuid not null references public.profiles(id),
    name text not null default 'Gewerbe',
    typ public.org_type not null default 'gewerbe',
    logo_url text
  );
  create table public.vereine (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null unique references public.profiles(id) on delete cascade,
    gemeinde_id uuid references public.gemeinden(id),
    verein_name text not null default 'Verein',
    typ text not null default 'verein' check (typ in ('verein', 'organisation')),
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
    gemeinde_id uuid,
    org_id uuid,
    channel public.post_channel not null default 'gemeinde',
    bild_url text,
    bilder_urls text[]
  );
  create table public.post_termine (
    id uuid primary key default gen_random_uuid(),
    post_id uuid not null references public.posts(id) on delete cascade
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
    gemeinde_id uuid,
    email text not null,
    rolle text not null default 'buerger',
    organisation_name text,
    verein_id uuid,
    org_id uuid,
    status text not null default 'offen'
      check (status in ('offen', 'angenommen', 'abgelaufen', 'widerrufen')),
    eingeladen_von uuid not null references public.profiles(id)
  );
  create table public.rollen_log (
    id uuid primary key default gen_random_uuid(),
    gemeinde_id uuid,
    aktion text not null default 'rolle_gesetzt'
      check (aktion in ('eingeladen', 'rolle_gesetzt', 'rolle_transfer', 'widerrufen')),
    ziel_profile_id uuid,
    ziel_email text not null,
    alte_rolle text,
    neue_rolle text,
    einladung_id uuid,
    ausgefuehrt_von uuid not null,
    erstellt_am timestamptz not null default now()
  );
`
```

- [ ] **Step 2: `kontoLoeschen.db.test.ts` auf das gemeinsame Schema umstellen**

In `src/lib/kontoLoeschen.db.test.ts` die Imports `readFileSync`/`path`, die Konstante `MIGRATION` und die Konstante `SCHEMA` (Zeilen 10–133) ersetzen durch:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { BASIS_SCHEMA, migration } from './testing/pgliteSchema'

const MIGRATION = migration('064_konto_loeschen.sql')
```

und im `beforeEach` `await db.exec(SCHEMA)` zu `await db.exec(BASIS_SCHEMA)` ändern. Die Zeile `import { beforeEach, describe, expect, it } from 'vitest'` und `import { PGlite } …` existieren schon — nicht doppelt importieren.

- [ ] **Step 3: Tests laufen lassen**

Run: `npx vitest run src/lib/kontoLoeschen.db.test.ts`
Expected: alle Tests PASS (gleiches Verhalten, nur anderes Schema).

- [ ] **Step 4: Commit**

```bash
git add src/lib/testing/pgliteSchema.ts src/lib/kontoLoeschen.db.test.ts
git commit -m "test: gemeinsames PGlite-Schema fuer Datenbanktests"
```

---

### Task 3: Migration 065, Teil 1 — Schema, Backfill, Grants

**Files:**
- Create: `supabase/migrations/065_mitgliedschaften.sql`
- Create: `src/lib/mitgliedschaften.db.test.ts`

- [ ] **Step 1: Failing test schreiben**

`src/lib/mitgliedschaften.db.test.ts`:

```ts
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
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `npx vitest run src/lib/mitgliedschaften.db.test.ts`
Expected: FAIL — `ENOENT … 065_mitgliedschaften.sql`

- [ ] **Step 3: Migration, Teil 1 schreiben**

`supabase/migrations/065_mitgliedschaften.sql` (falls Task 1c weitere Aktionen gefunden hat, in die Liste bei `rollen_log_aktion_check` aufnehmen):

```sql
-- 065: Mehrere Autoren und Verwalter pro Verein, Organisation und Gewerbe.
--
-- Bisher gehörte ein Verein (vereine, Rollen verein/organisation) bzw. ein Gewerbe
-- (organisationen, Rolle gewerbe) genau einem Konto (profile_id). Löschte dieses
-- Konto sich, löschte die Cascade den Verein samt Abonnenten und Beiträgen.
--
-- Jetzt hängen die Rechte an public.mitgliedschaften:
--   * eine Person ist Mitglied in höchstens EINEM Verein/Gewerbe (profile_id ist PK),
--   * Mitgliedsrolle 'verwalter' (Profil, Mitglieder, Löschen) oder 'autor' (Beiträge),
--   * profiles.role ist verein/organisation/gewerbe genau dann, wenn es eine
--     Mitgliedschaft gibt (Ausnahme: Selbstanlage steht noch aus). Rolle und
--     Mitgliedschaft ändern nur die Funktionen unten, jeweils in einer Transaktion.
--
-- Rückwärtskompatibel: Alter Code (liest vereine.profile_id) läuft bis zum Deploy
-- weiter. NACH dem Deploy 066 einspielen.
--
-- Spec: docs/superpowers/specs/2026-11-02-vereins-mitglieder-design.md
-- Kontolöschung ändert sich mit — /konto-loeschen und Datenschutzerklärung (Ziffer 7)
-- beschreiben das neue Verhalten.

-- ─── Vorbedingung: niemand ist mehreren Vereinen/Gewerben zugeordnet ─────────
do $$
declare
  v_anzahl int;
begin
  select count(*) into v_anzahl
  from (
    select profile_id
    from (
      select profile_id from public.vereine where profile_id is not null
      union all
      select profile_id from public.organisationen where profile_id is not null
    ) x
    group by profile_id
    having count(*) > 1
  ) d;

  if v_anzahl > 0 then
    raise exception '065: % Konten sind mehreren Vereinen/Gewerben zugeordnet. Vorher bereinigen.', v_anzahl;
  end if;
end $$;

-- ─── Eigentümer-Spalten lockern (werden nicht mehr gelesen, später entfernt) ─
alter table public.vereine alter column profile_id drop not null;
alter table public.vereine drop constraint if exists vereine_profile_id_key;
alter table public.vereine drop constraint if exists vereine_profile_id_fkey;
alter table public.vereine
  add constraint vereine_profile_id_fkey
  foreign key (profile_id) references public.profiles(id) on delete set null;

alter table public.organisationen alter column profile_id drop not null;
alter table public.organisationen drop constraint if exists organisationen_profile_id_fkey;
alter table public.organisationen
  add constraint organisationen_profile_id_fkey
  foreign key (profile_id) references public.profiles(id) on delete set null;

-- ─── Beiträge überleben ihren Autor (Vereins- und Gewerbebeiträge) ───────────
-- Constraint-Name bleibt gleich: Abfragen nutzen profiles_public!posts_author_id_fkey.
alter table public.posts alter column author_id drop not null;
alter table public.posts drop constraint if exists posts_author_id_fkey;
alter table public.posts
  add constraint posts_author_id_fkey
  foreign key (author_id) references public.profiles(id) on delete set null;

-- Alt-Beiträge ohne org_id dem Verein/Gewerbe ihres Autors zuordnen. Rechte und
-- Anzeige hängen ab jetzt an org_id, nicht mehr an author_id.
update public.posts p
   set org_id = v.id
  from public.vereine v
 where p.channel::text = 'verein'
   and p.org_id is null
   and v.profile_id = p.author_id;

update public.posts p
   set org_id = o.id
  from public.organisationen o
 where p.channel::text = 'gewerbe'
   and p.org_id is null
   and o.profile_id = p.author_id;

-- ─── Mitgliedschaften ────────────────────────────────────────────────────────
create table public.mitgliedschaften (
  profile_id       uuid primary key references public.profiles(id) on delete cascade,
  verein_id        uuid references public.vereine(id) on delete cascade,
  organisation_id  uuid references public.organisationen(id) on delete cascade,
  rolle            text not null check (rolle in ('verwalter', 'autor')),
  hinzugefuegt_von uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint mitgliedschaften_genau_ein_ziel check (num_nonnulls(verein_id, organisation_id) = 1)
);

create index mitgliedschaften_verein_idx on public.mitgliedschaften (verein_id);
create index mitgliedschaften_organisation_idx on public.mitgliedschaften (organisation_id);

alter table public.mitgliedschaften enable row level security;

-- Nur die eigene Zeile. Mitgliederlisten lädt der Server mit service_role nach der
-- Berechtigungsprüfung — eine Policy „Mitglieder desselben Vereins“ auf derselben
-- Tabelle wäre rekursiv.
create policy "mitgliedschaften_eigene_lesen" on public.mitgliedschaften
  for select to authenticated
  using (profile_id = auth.uid());

grant select on public.mitgliedschaften to authenticated;
grant select, insert, update, delete on public.mitgliedschaften to service_role;

-- Backfill: bisherige Eigentümer werden Verwalter
insert into public.mitgliedschaften (profile_id, verein_id, rolle)
select profile_id, id, 'verwalter' from public.vereine where profile_id is not null
on conflict (profile_id) do nothing;

insert into public.mitgliedschaften (profile_id, organisation_id, rolle)
select profile_id, id, 'verwalter' from public.organisationen where profile_id is not null
on conflict (profile_id) do nothing;

-- ─── Einladungen in einen bestehenden Verein ─────────────────────────────────
alter table public.einladungen
  add column if not exists mitglied_rolle text
  check (mitglied_rolle in ('verwalter', 'autor'));

-- ─── Rollen-Protokoll: neue Aktionen ─────────────────────────────────────────
-- Name der Constraint ist in Produktion nicht gesichert (Tabelle wurde früher von
-- Hand angelegt) — deshalb über pg_constraint suchen, wie in 011.
do $$
declare
  v_constraint text;
begin
  select conname into v_constraint
  from pg_constraint
  where conrelid = 'public.rollen_log'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%aktion%';

  if v_constraint is not null then
    execute format('alter table public.rollen_log drop constraint %I', v_constraint);
  end if;

  alter table public.rollen_log
    add constraint rollen_log_aktion_check
    check (aktion in (
      'eingeladen', 'rolle_gesetzt', 'rolle_transfer', 'widerrufen',
      'mitglied_hinzugefuegt', 'mitglied_entfernt', 'mitglied_rolle_geaendert', 'verein_geloescht'
    ));
end $$;
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run src/lib/mitgliedschaften.db.test.ts src/lib/kontoLoeschen.db.test.ts`
Expected: PASS (der Kontolöschungs-Test lädt 065 noch nicht).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/065_mitgliedschaften.sql src/lib/mitgliedschaften.db.test.ts
git commit -m "feat: Tabelle mitgliedschaften mit Backfill (Migration 065, Teil 1)"
```

---

### Task 4: Migration 065, Teil 2 — Hilfsfunktionen, hinzufügen, entfernen, Rolle ändern

**Files:**
- Modify: `supabase/migrations/065_mitgliedschaften.sql` (anhängen)
- Modify: `src/lib/mitgliedschaften.db.test.ts` (anhängen)

- [ ] **Step 1: Failing tests anhängen**

```ts
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
    await expect(rolleAendern(ANNA, 'autor', BERT)).resolves.toBeDefined()
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
})
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `npx vitest run src/lib/mitgliedschaften.db.test.ts`
Expected: FAIL — `function public.mitglied_hinzufuegen(...) does not exist`

- [ ] **Step 3: Funktionen an 065 anhängen**

```sql
-- ═══ Funktionen ═══════════════════════════════════════════════════════════════
-- Fehlercodes (die API übersetzt sie, siehe src/lib/mitgliedschaft.ts rpcFehler):
--   42501 Keine Berechtigung · P0001 fachliche Ablehnung (Meldung wird angezeigt)
--   P0002 nicht gefunden     · 22023 ungültige Angabe

-- ─── Ziel (Verein oder Gewerbe) lesen und für die Transaktion sperren ────────
create or replace function public._vereinsziel(
  p_verein_id uuid,
  p_organisation_id uuid,
  out o_gemeinde_id uuid,
  out o_rolle text,
  out o_name text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if num_nonnulls(p_verein_id, p_organisation_id) <> 1 then
    raise exception 'Bitte genau einen Verein oder ein Gewerbe angeben.' using errcode = '22023';
  end if;

  if p_verein_id is not null then
    select v.gemeinde_id, v.typ, v.verein_name
      into o_gemeinde_id, o_rolle, o_name
      from public.vereine v
     where v.id = p_verein_id
       for update;
  else
    select o.gemeinde_id, 'gewerbe', o.name
      into o_gemeinde_id, o_rolle, o_name
      from public.organisationen o
     where o.id = p_organisation_id
       for update;
  end if;

  if o_rolle is null then
    raise exception 'Verein oder Gewerbe nicht gefunden.' using errcode = 'P0002';
  end if;
end;
$$;

-- ─── Recht eines Akteurs auf ein Ziel: 'verwaltung' | 'verwalter' | null ─────
create or replace function public._mitglieder_recht(
  p_akteur uuid,
  p_verein_id uuid,
  p_organisation_id uuid,
  p_gemeinde_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.profiles p
       where p.id = p_akteur
         and (p.role::text = 'super_admin'
              or (p.role::text = 'verwaltung' and p.gemeinde_id = p_gemeinde_id))
    ) then 'verwaltung'
    when exists (
      select 1 from public.mitgliedschaften m
       where m.profile_id = p_akteur
         and m.rolle = 'verwalter'
         and (m.verein_id = p_verein_id or m.organisation_id = p_organisation_id)
    ) then 'verwalter'
  end
$$;

-- ─── Protokoll ───────────────────────────────────────────────────────────────
create or replace function public._rollen_log(
  p_gemeinde_id uuid,
  p_aktion text,
  p_profile_id uuid,
  p_alte text,
  p_neue text,
  p_akteur uuid
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.rollen_log
    (gemeinde_id, aktion, ziel_profile_id, ziel_email, alte_rolle, neue_rolle, ausgefuehrt_von)
  select p_gemeinde_id, p_aktion, p.id, coalesce(p.email, ''), p_alte, p_neue, coalesce(p_akteur, p.id)
    from public.profiles p
   where p.id = p_profile_id
$$;

-- ─── Gibt es außer p_ohne noch einen Verwalter? ──────────────────────────────
create or replace function public._weiterer_verwalter(
  p_verein_id uuid,
  p_organisation_id uuid,
  p_ohne uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.mitgliedschaften m
     where m.profile_id <> p_ohne
       and m.rolle = 'verwalter'
       and (m.verein_id = p_verein_id or m.organisation_id = p_organisation_id)
  )
$$;

-- ─── Eintragen ohne Rechteprüfung (nur intern) ───────────────────────────────
-- p_jede_rolle: true nur für die Verwaltung bei verein_anlegen — dann darf die
-- Person vorher eine beliebige Rolle haben (bewusster Rollenwechsel).
create or replace function public._mitglied_eintragen(
  p_profile_id uuid,
  p_verein_id uuid,
  p_organisation_id uuid,
  p_rolle text,
  p_akteur uuid,
  p_jede_rolle boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  z record;
  v_alte_rolle text;
  v_gemeinde uuid;
begin
  select * into z from public._vereinsziel(p_verein_id, p_organisation_id);

  select p.role::text, p.gemeinde_id
    into v_alte_rolle, v_gemeinde
    from public.profiles p
   where p.id = p_profile_id
     for update;
  if not found then
    raise exception 'Konto nicht gefunden.' using errcode = 'P0002';
  end if;

  if v_gemeinde is distinct from z.o_gemeinde_id then
    raise exception 'Diese Person gehört nicht zu dieser Gemeinde.' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.mitgliedschaften m where m.profile_id = p_profile_id)
     or (not p_jede_rolle and v_alte_rolle not in ('buerger', z.o_rolle)) then
    raise exception 'Diese Person ist bereits einem Verein zugeordnet oder hat eine andere Rolle.'
      using errcode = 'P0001';
  end if;

  insert into public.mitgliedschaften (profile_id, verein_id, organisation_id, rolle, hinzugefuegt_von)
  values (p_profile_id, p_verein_id, p_organisation_id, p_rolle, p_akteur);

  update public.profiles set role = z.o_rolle::public.user_role where id = p_profile_id;

  perform public._rollen_log(z.o_gemeinde_id, 'mitglied_hinzugefuegt', p_profile_id, v_alte_rolle, z.o_rolle, p_akteur);
end;
$$;

-- ─── Mitglied hinzufügen (Verwalter des Vereins oder Verwaltung) ─────────────
create or replace function public.mitglied_hinzufuegen(
  p_profile_id uuid,
  p_rolle text,
  p_ausgefuehrt_von uuid,
  p_verein_id uuid default null,
  p_organisation_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  z record;
begin
  select * into z from public._vereinsziel(p_verein_id, p_organisation_id);

  if public._mitglieder_recht(p_ausgefuehrt_von, p_verein_id, p_organisation_id, z.o_gemeinde_id) is null then
    raise exception 'Keine Berechtigung.' using errcode = '42501';
  end if;

  perform public._mitglied_eintragen(p_profile_id, p_verein_id, p_organisation_id, p_rolle, p_ausgefuehrt_von, false);
end;
$$;

-- ─── Mitglied entfernen (auch: selbst austreten) ─────────────────────────────
create or replace function public.mitglied_entfernen(
  p_profile_id uuid,
  p_ausgefuehrt_von uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  z record;
  v_recht text;
begin
  select * into m from public.mitgliedschaften where profile_id = p_profile_id;
  if not found then
    raise exception 'Diese Person ist kein Mitglied.' using errcode = 'P0002';
  end if;

  -- Erst das Ziel sperren, dann die Mitgliedschaft neu lesen: so sehen parallele
  -- Aufrufe für denselben Verein die Verwalter-Anzahl nacheinander.
  select * into z from public._vereinsziel(m.verein_id, m.organisation_id);
  select * into m from public.mitgliedschaften where profile_id = p_profile_id for update;
  if not found then
    raise exception 'Diese Person ist kein Mitglied.' using errcode = 'P0002';
  end if;

  v_recht := public._mitglieder_recht(p_ausgefuehrt_von, m.verein_id, m.organisation_id, z.o_gemeinde_id);
  if v_recht is null and p_ausgefuehrt_von is distinct from p_profile_id then
    raise exception 'Keine Berechtigung.' using errcode = '42501';
  end if;

  if m.rolle = 'verwalter'
     and v_recht is distinct from 'verwaltung'
     and not public._weiterer_verwalter(m.verein_id, m.organisation_id, p_profile_id) then
    raise exception 'Der letzte Verwalter kann nicht entfernt werden. Lege zuerst eine andere Person als Verwalter fest.'
      using errcode = 'P0001';
  end if;

  delete from public.mitgliedschaften where profile_id = p_profile_id;
  update public.profiles set role = 'buerger' where id = p_profile_id;

  perform public._rollen_log(z.o_gemeinde_id, 'mitglied_entfernt', p_profile_id, z.o_rolle, 'buerger', p_ausgefuehrt_von);
end;
$$;

-- ─── Mitgliedsrolle ändern ───────────────────────────────────────────────────
create or replace function public.mitglied_rolle_aendern(
  p_profile_id uuid,
  p_rolle text,
  p_ausgefuehrt_von uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  z record;
  v_recht text;
begin
  select * into m from public.mitgliedschaften where profile_id = p_profile_id;
  if not found then
    raise exception 'Diese Person ist kein Mitglied.' using errcode = 'P0002';
  end if;

  select * into z from public._vereinsziel(m.verein_id, m.organisation_id);
  select * into m from public.mitgliedschaften where profile_id = p_profile_id for update;

  v_recht := public._mitglieder_recht(p_ausgefuehrt_von, m.verein_id, m.organisation_id, z.o_gemeinde_id);
  if v_recht is null then
    raise exception 'Keine Berechtigung.' using errcode = '42501';
  end if;

  if m.rolle = p_rolle then
    return;
  end if;

  if m.rolle = 'verwalter'
     and v_recht is distinct from 'verwaltung'
     and not public._weiterer_verwalter(m.verein_id, m.organisation_id, p_profile_id) then
    raise exception 'Der letzte Verwalter kann nicht herabgestuft werden. Lege zuerst eine andere Person als Verwalter fest.'
      using errcode = 'P0001';
  end if;

  update public.mitgliedschaften set rolle = p_rolle where profile_id = p_profile_id;

  perform public._rollen_log(z.o_gemeinde_id, 'mitglied_rolle_geaendert', p_profile_id, m.rolle, p_rolle, p_ausgefuehrt_von);
end;
$$;
```

Und ganz ans Ende der Datei (wird in Task 5 und 6 erweitert):

```sql
-- ═══ Grants ═══════════════════════════════════════════════════════════════════
-- Hilfsfunktionen (_…) nur intern. Öffentliche Funktionen nur für service_role:
-- die API-Routen übergeben die Akteur-ID aus der Session, nie aus dem Request.
revoke all on function public._vereinsziel(uuid, uuid) from public, anon, authenticated;
revoke all on function public._mitglieder_recht(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public._rollen_log(uuid, text, uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public._weiterer_verwalter(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public._mitglied_eintragen(uuid, uuid, uuid, text, uuid, boolean) from public, anon, authenticated;

revoke all on function public.mitglied_hinzufuegen(uuid, text, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.mitglied_entfernen(uuid, uuid) from public, anon, authenticated;
revoke all on function public.mitglied_rolle_aendern(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.mitglied_hinzufuegen(uuid, text, uuid, uuid, uuid) to service_role;
grant execute on function public.mitglied_entfernen(uuid, uuid) to service_role;
grant execute on function public.mitglied_rolle_aendern(uuid, text, uuid) to service_role;
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run src/lib/mitgliedschaften.db.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/065_mitgliedschaften.sql src/lib/mitgliedschaften.db.test.ts
git commit -m "feat: Mitglieder hinzufuegen, entfernen, Rolle aendern (Migration 065, Teil 2)"
```

---

### Task 5: Migration 065, Teil 3 — Verein anlegen, Einladung einlösen

**Files:**
- Modify: `supabase/migrations/065_mitgliedschaften.sql`
- Modify: `src/lib/mitgliedschaften.db.test.ts`

- [ ] **Step 1: Failing tests anhängen**

```ts
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
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `npx vitest run src/lib/mitgliedschaften.db.test.ts`
Expected: FAIL — `function public.verein_anlegen(...) does not exist`

- [ ] **Step 3: Funktionen vor dem Abschnitt „Grants“ in 065 einfügen**

```sql
-- ─── Zeile für Verein (verein/organisation) oder Gewerbe anlegen (nur intern) ─
create or replace function public._vereinszeile_anlegen(
  p_typ text,
  p_gemeinde_id uuid,
  p_name text,
  p_profile_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_typ = 'gewerbe' then
    insert into public.organisationen (gemeinde_id, profile_id, name, typ)
    values (p_gemeinde_id, p_profile_id, p_name, 'gewerbe')
    returning id into v_id;
  elsif p_typ in ('verein', 'organisation') then
    insert into public.vereine (gemeinde_id, profile_id, verein_name, typ)
    values (p_gemeinde_id, p_profile_id, p_name, p_typ)
    returning id into v_id;
  else
    raise exception 'Unbekannter Typ %.', p_typ using errcode = '22023';
  end if;
  return v_id;
end;
$$;

-- ─── Verein/Organisation/Gewerbe anlegen, Person wird Verwalter ──────────────
-- Erlaubt für
--   * die Verwaltung der Gemeinde (Person ohne Mitgliedschaft, beliebige Rolle),
--   * die Person selbst, wenn ihre Rolle zum Typ passt (Selbstanlage im Dashboard).
create or replace function public.verein_anlegen(
  p_profile_id uuid,
  p_typ text,
  p_name text,
  p_ausgefuehrt_von uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rolle text;
  v_gemeinde uuid;
  v_akteur_rolle text;
  v_akteur_gemeinde uuid;
  v_jede_rolle boolean;
  v_id uuid;
begin
  if p_typ not in ('verein', 'organisation', 'gewerbe') then
    raise exception 'Unbekannter Typ %.', p_typ using errcode = '22023';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'Bitte einen Namen angeben.' using errcode = '22023';
  end if;

  select p.role::text, p.gemeinde_id into v_rolle, v_gemeinde
    from public.profiles p where p.id = p_profile_id for update;
  if not found then
    raise exception 'Konto nicht gefunden.' using errcode = 'P0002';
  end if;
  if v_gemeinde is null then
    raise exception 'Diese Person ist keiner Gemeinde zugeordnet.' using errcode = 'P0001';
  end if;

  select p.role::text, p.gemeinde_id into v_akteur_rolle, v_akteur_gemeinde
    from public.profiles p where p.id = p_ausgefuehrt_von;

  if v_akteur_rolle = 'super_admin'
     or (v_akteur_rolle = 'verwaltung' and v_akteur_gemeinde = v_gemeinde) then
    v_jede_rolle := true;
  elsif p_ausgefuehrt_von = p_profile_id and v_rolle = p_typ then
    v_jede_rolle := false;
  else
    raise exception 'Keine Berechtigung.' using errcode = '42501';
  end if;

  if exists (select 1 from public.mitgliedschaften m where m.profile_id = p_profile_id) then
    raise exception 'Diese Person ist bereits einem Verein zugeordnet oder hat eine andere Rolle.'
      using errcode = 'P0001';
  end if;

  v_id := public._vereinszeile_anlegen(p_typ, v_gemeinde, btrim(p_name), p_profile_id);

  if p_typ = 'gewerbe' then
    perform public._mitglied_eintragen(p_profile_id, null, v_id, 'verwalter', p_ausgefuehrt_von, v_jede_rolle);
  else
    perform public._mitglied_eintragen(p_profile_id, v_id, null, 'verwalter', p_ausgefuehrt_von, v_jede_rolle);
  end if;

  return v_id;
end;
$$;

-- ─── Einladung beim Registrieren einlösen ────────────────────────────────────
-- profilAnlegen markiert die Einladung als angenommen und legt das Profil mit der
-- eingeladenen Rolle an; danach entsteht hier die Mitgliedschaft.
create or replace function public.einladung_einloesen(
  p_profile_id uuid,
  p_einladung_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e record;
  v_email text;
  v_id uuid;
begin
  select * into e from public.einladungen where id = p_einladung_id;
  if not found then
    raise exception 'Einladung nicht gefunden.' using errcode = 'P0002';
  end if;

  select p.email into v_email from public.profiles p where p.id = p_profile_id;
  if lower(coalesce(v_email, '')) <> lower(e.email) then
    raise exception 'Diese Einladung ist für eine andere E-Mail-Adresse ausgestellt.' using errcode = '42501';
  end if;
  if e.status <> 'angenommen' then
    raise exception 'Die Einladung wurde nicht angenommen.' using errcode = 'P0001';
  end if;

  if e.rolle not in ('verein', 'organisation', 'gewerbe') then
    return;
  end if;

  if e.verein_id is not null or e.org_id is not null then
    perform public._mitglied_eintragen(
      p_profile_id, e.verein_id, e.org_id, coalesce(e.mitglied_rolle, 'autor'), e.eingeladen_von, false);
  elsif coalesce(btrim(e.organisation_name), '') <> '' then
    v_id := public._vereinszeile_anlegen(e.rolle, e.gemeinde_id, btrim(e.organisation_name), p_profile_id);
    if e.rolle = 'gewerbe' then
      perform public._mitglied_eintragen(p_profile_id, null, v_id, 'verwalter', e.eingeladen_von, false);
    else
      perform public._mitglied_eintragen(p_profile_id, v_id, null, 'verwalter', e.eingeladen_von, false);
    end if;
  end if;
end;
$$;
```

Im Abschnitt „Grants“ ergänzen:

```sql
revoke all on function public._vereinszeile_anlegen(text, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.verein_anlegen(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.einladung_einloesen(uuid, uuid) from public, anon, authenticated;
grant execute on function public.verein_anlegen(uuid, text, text, uuid) to service_role;
grant execute on function public.einladung_einloesen(uuid, uuid) to service_role;
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run src/lib/mitgliedschaften.db.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/065_mitgliedschaften.sql src/lib/mitgliedschaften.db.test.ts
git commit -m "feat: Verein anlegen und Einladung einloesen (Migration 065, Teil 3)"
```

---

### Task 6: Migration 065, Teil 4 — Verein löschen, Dateipfade

**Files:**
- Modify: `supabase/migrations/065_mitgliedschaften.sql`
- Modify: `src/lib/mitgliedschaften.db.test.ts`

- [ ] **Step 1: Failing tests anhängen**

```ts
describe('verein_loeschen / verein_dateipfade', () => {
  const URL = 'https://xyz.supabase.co/storage/v1/object/public/dorfly-media/'
  let verein: string
  let anderer: string

  beforeEach(async () => {
    await neueDb(async () => {
      await nutzer(ANNA, 'anna@example.de', 'verein')
      await nutzer(DORA, 'dora@example.de', 'verein')
      verein = (await db.query<{ id: string }>(
        `insert into public.vereine (profile_id, gemeinde_id, logo_url) values ($1, $2, $3) returning id`,
        [ANNA, G1, `${URL}vereine/logo.jpg`])).rows[0].id
      anderer = (await db.query<{ id: string }>(
        `insert into public.vereine (profile_id, gemeinde_id) values ($1, $2) returning id`, [DORA, G1])).rows[0].id
    })
    await nutzer(BERT, 'bert@example.de')
    await nutzer(CARL, 'carl@example.de')
    await db.query('select public.mitglied_hinzufuegen($1, $2, $3, $4)', [BERT, 'autor', ANNA, verein])
    const post = (await db.query<{ id: string }>(
      `insert into public.posts (author_id, org_id, channel, bild_url, bilder_urls) values ($1, $2, 'verein', $3, $4) returning id`,
      [BERT, verein, `${URL}posts/a.jpg`, [`${URL}posts/b.jpg`]])).rows[0].id
    await db.query('insert into public.post_termine (post_id) values ($1)', [post])
    await db.query(`insert into public.posts (author_id, org_id, channel) values ($1, $2, 'verein')`, [DORA, anderer])
    await db.query('insert into public.verein_abonnements (user_id, verein_id) values ($1, $2)', [CARL, verein])
    await db.query(
      `insert into public.einladungen (gemeinde_id, email, rolle, verein_id, status, eingeladen_von)
       values ($1, 'neu@example.de', 'verein', $2, 'offen', $3)`, [G1, verein, ANNA])
    await db.query(
      `insert into storage.objects (bucket_id, name) values
        ('dorfly-media', 'vereine/${verein}/alt.jpg'),
        ('dorfly-media', 'vereine/${anderer}/fremd.jpg')`)
  })

  it('liefert Logo, Beitragsbilder und den Vereinsordner — nichts vom anderen Verein', async () => {
    const res = await db.query<{ pfad: string }>('select public.verein_dateipfade($1) as pfad', [verein])
    expect(res.rows.map(r => r.pfad).sort()).toEqual(
      ['posts/a.jpg', 'posts/b.jpg', `vereine/${verein}/alt.jpg`, 'vereine/logo.jpg'].sort(),
    )
  })

  it('löscht Verein, Beiträge, Abos, Mitgliedschaften und setzt alle auf buerger', async () => {
    const res = await db.query<{ mitglied_id: string; mitglied_email: string }>(
      'select * from public.verein_loeschen($1, $2)', [ANNA, verein])
    expect(res.rows.map(r => r.mitglied_id)).toEqual([BERT])   // ohne die Löschende

    expect(await wert<number>('select count(*)::int from public.vereine where id = $1', [verein])).toBe(0)
    expect(await wert<number>('select count(*)::int from public.posts where org_id = $1', [verein])).toBe(0)
    expect(await wert<number>('select count(*)::int from public.post_termine')).toBe(0)
    expect(await wert<number>('select count(*)::int from public.verein_abonnements')).toBe(0)
    expect(await rolle(ANNA)).toBe('buerger')
    expect(await rolle(BERT)).toBe('buerger')
    expect(await wert<string>(`select status from public.einladungen where email = 'neu@example.de'`)).toBe('widerrufen')
    expect(await wert<number>(`select count(*)::int from public.rollen_log where aktion = 'verein_geloescht'`)).toBe(2)
    // Anderer Verein unberührt
    expect(await wert<number>('select count(*)::int from public.posts where org_id = $1', [anderer])).toBe(1)
    expect(await rolle(DORA)).toBe('verein')
  })

  it('verweigert Autoren das Löschen und ändert nichts', async () => {
    await expect(db.query('select * from public.verein_loeschen($1, $2)', [BERT, verein])).rejects.toThrow(/Keine Berechtigung/)
    expect(await wert<number>('select count(*)::int from public.vereine where id = $1', [verein])).toBe(1)
  })

  it('erlaubt der Verwaltung das Löschen', async () => {
    await db.query('select * from public.verein_loeschen($1, $2)', [VERWALTUNG, verein])
    expect(await wert<number>('select count(*)::int from public.vereine where id = $1', [verein])).toBe(0)
  })
})
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `npx vitest run src/lib/mitgliedschaften.db.test.ts`
Expected: FAIL — `function public.verein_dateipfade(...) does not exist`

- [ ] **Step 3: Funktionen vor „Grants“ einfügen**

```sql
-- ─── Storage-Pfade eines Vereins/Gewerbes (nur lesend) ───────────────────────
-- Die API-Route löscht die Dateien VOR verein_loeschen (Muster wie Kontolöschung).
create or replace function public.verein_dateipfade(
  p_verein_id uuid default null,
  p_organisation_id uuid default null
)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  with urls as (
    select logo_url as url from public.vereine where id = p_verein_id
    union all select logo_url from public.organisationen where id = p_organisation_id
    union all select bild_url from public.posts where org_id = coalesce(p_verein_id, p_organisation_id)
    union all select unnest(bilder_urls) from public.posts where org_id = coalesce(p_verein_id, p_organisation_id)
  ),
  aus_urls as (
    select nullif(split_part(url, '/storage/v1/object/public/dorfly-media/', 2), '') as pfad
    from urls
    where url is not null
  ),
  ordner as (
    select 'vereine/' || p_verein_id || '/' as praefix where p_verein_id is not null
    union all select 'gewerbe/' || p_organisation_id || '/' where p_organisation_id is not null
  ),
  aus_ordnern as (
    select o.name as pfad
    from storage.objects o
    join ordner on starts_with(o.name, ordner.praefix)
    where o.bucket_id = 'dorfly-media'
  )
  select pfad from aus_urls where pfad is not null
  union
  select pfad from aus_ordnern
$$;

-- ─── Verein/Gewerbe löschen (Verwalter oder Verwaltung) ──────────────────────
-- Liefert die übrigen Mitglieder (ohne die löschende Person) für die Benachrichtigung.
create or replace function public.verein_loeschen(
  p_ausgefuehrt_von uuid,
  p_verein_id uuid default null,
  p_organisation_id uuid default null
)
returns table (mitglied_id uuid, mitglied_email text, mitglied_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  z record;
  v_ziel uuid := coalesce(p_verein_id, p_organisation_id);
begin
  select * into z from public._vereinsziel(p_verein_id, p_organisation_id);

  if public._mitglieder_recht(p_ausgefuehrt_von, p_verein_id, p_organisation_id, z.o_gemeinde_id) is null then
    raise exception 'Keine Berechtigung.' using errcode = '42501';
  end if;

  return query
    select m.profile_id, p.email, p.display_name
      from public.mitgliedschaften m
      join public.profiles p on p.id = m.profile_id
     where (m.verein_id = p_verein_id or m.organisation_id = p_organisation_id)
       and m.profile_id is distinct from p_ausgefuehrt_von;

  perform public._rollen_log(z.o_gemeinde_id, 'verein_geloescht', m.profile_id, z.o_rolle, 'buerger', p_ausgefuehrt_von)
     from public.mitgliedschaften m
    where m.verein_id = p_verein_id or m.organisation_id = p_organisation_id;

  update public.profiles p
     set role = 'buerger'
    from public.mitgliedschaften m
   where m.profile_id = p.id
     and (m.verein_id = p_verein_id or m.organisation_id = p_organisation_id);

  update public.einladungen
     set status = 'widerrufen'
   where status = 'offen'
     and (verein_id = p_verein_id or org_id = p_organisation_id);

  -- posts.org_id hat keinen Fremdschlüssel (033) — ausdrücklich löschen.
  -- post_termine hängt per Cascade dran.
  delete from public.posts where org_id = v_ziel;

  -- Cascade: Abonnements, Mitgliedschaften
  if p_verein_id is not null then
    delete from public.vereine where id = p_verein_id;
  else
    delete from public.organisationen where id = p_organisation_id;
  end if;
end;
$$;
```

Im Abschnitt „Grants“ ergänzen:

```sql
revoke all on function public.verein_dateipfade(uuid, uuid) from public, anon, authenticated;
revoke all on function public.verein_loeschen(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.verein_dateipfade(uuid, uuid) to service_role;
grant execute on function public.verein_loeschen(uuid, uuid, uuid) to service_role;
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run src/lib/mitgliedschaften.db.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/065_mitgliedschaften.sql src/lib/mitgliedschaften.db.test.ts
git commit -m "feat: Verein oder Gewerbe loeschen (Migration 065, Teil 4)"
```

---

### Task 7: Migration 065, Teil 5 — Kontolöschung neu

**Files:**
- Modify: `supabase/migrations/065_mitgliedschaften.sql`
- Modify: `src/lib/kontoLoeschen.db.test.ts`

- [ ] **Step 1: Kontolöschungs-Test auf 064 + 065 umstellen und neue Erwartungen schreiben**

In `src/lib/kontoLoeschen.db.test.ts`:

```ts
const MIGRATION = migration('064_konto_loeschen.sql') + '\n' + migration('065_mitgliedschaften.sql')
```

Neuen `describe`-Block vor `describe('konto_loeschen — ganz oder gar nicht', …)` einfügen:

```ts
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
```

Im bestehenden Test `describe('konto_dateipfade', …)` die erwartete Liste anpassen — Vereinslogo und Vereinsordner gehören nicht mehr dazu. Die beiden Zeilen

```ts
      `vereine/${vereinId}/logo_alt.jpg`,
      'vereine/x/logo_2.jpg',
```

aus `expect(pfade).toEqual([...])` entfernen und den Testnamen ändern zu `'liefert referenzierte Bilder und eigene Ordner, aber nie gemeinden/ und nie Vereinsdateien'`.

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `npx vitest run src/lib/kontoLoeschen.db.test.ts`
Expected: FAIL — „lässt Verein … stehen“ schlägt fehl (die Cascade aus 064 löscht noch Beiträge mit Autor).

- [ ] **Step 3: Neue `konto_loeschen` und `konto_dateipfade` vor „Grants“ in 065 einfügen**

```sql
-- ═══ Kontolöschung (ersetzt 064) ═════════════════════════════════════════════
-- Änderung gegenüber 064: Vereine und Gewerbe überleben das Konto. Die
-- Mitgliedschaft fällt per Cascade weg, Vereins-/Gewerbebeiträge bleiben ohne
-- Autor (author_id = null). War die Person letzter Verwalter, zeigt die Verwaltung
-- „Kein Verwalter“ an.

create or replace function public.konto_dateipfade(p_user_id uuid)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  with urls as (
    select foto_url as url from public.maengel where melder_id = p_user_id
    union all
      select bild_url from public.posts
      where author_id = p_user_id and not (org_id is not null and channel::text in ('verein', 'gewerbe'))
    union all
      select unnest(bilder_urls) from public.posts
      where author_id = p_user_id and not (org_id is not null and channel::text in ('verein', 'gewerbe'))
    union all select unnest(u.bilder_urls) from public.umfragen u where u.author_id = p_user_id
    union all
      select unnest(f.bilder_urls)
      from public.umfrage_fragen f
      join public.umfragen u on u.id = f.umfrage_id
      where u.author_id = p_user_id
    union all select avatar_url from public.profiles where id = p_user_id
  ),
  aus_urls as (
    select nullif(split_part(url, '/storage/v1/object/public/dorfly-media/', 2), '') as pfad
    from urls
    where url is not null
  ),
  ordner as (
    select 'gemeinderat/' || p_user_id || '/' as praefix
    union all select 'umfragen/tmp/' || p_user_id || '/'
    union all select 'umfragen/' || id || '/' from public.umfragen where author_id = p_user_id
  ),
  aus_ordnern as (
    select o.name as pfad
    from storage.objects o
    join ordner on starts_with(o.name, ordner.praefix)
    where o.bucket_id = 'dorfly-media'
  )
  select pfad from aus_urls where pfad is not null
  union
  select pfad from aus_ordnern
$$;

create or replace function public.konto_loeschen(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_platzhalter constant text := 'geloeschtes-konto';
  v_emails text[];
begin
  perform 1 from auth.users where id = p_user_id for update;
  if not found then
    raise exception 'Konto % nicht gefunden', p_user_id using errcode = 'P0002';
  end if;

  select array_agg(distinct lower(e)) into v_emails
  from (
    select email as e from auth.users where id = p_user_id
    union all
    select email from public.profiles where id = p_user_id
  ) x
  where e is not null;

  update public.umfrage_antworten set user_id = null where user_id = p_user_id;
  update public.umfrage_teilnahmen set user_id = null where user_id = p_user_id;

  update public.rollen_log
     set ziel_email = v_platzhalter,
         ziel_profile_id = null
   where ziel_profile_id = p_user_id
      or lower(ziel_email) = any(coalesce(v_emails, '{}'));

  update public.einladungen
     set email = v_platzhalter,
         status = case when status = 'offen' then 'widerrufen' else status end
   where lower(email) = any(coalesce(v_emails, '{}'));

  -- Vereins- und Gewerbebeiträge gehören dem Verein: bleiben, ohne Autor
  update public.posts
     set author_id = null
   where author_id = p_user_id
     and org_id is not null
     and channel::text in ('verein', 'gewerbe');

  delete from public.umfragen where author_id = p_user_id;
  delete from public.posts where author_id = p_user_id;
  delete from public.maengel where melder_id = p_user_id;
  delete from public.fragen where fragesteller_id = p_user_id;
  delete from public.gemeinderat_fragen
   where fragesteller_id = p_user_id or gemeinderat_id = p_user_id;
  delete from public.gewerbe_abonnements where user_id = p_user_id;

  -- Cascade: mitgliedschaften, verein_abonnements.
  -- Set null: vereine.profile_id, organisationen.profile_id, einladungen.eingeladen_von,
  --           mitgliedschaften.hinzugefuegt_von.
  delete from public.profiles where id = p_user_id;

  -- Cascade: meldungen, abfallkalender_praeferenzen, Sessions und Identitäten
  delete from auth.users where id = p_user_id;
end;
$$;
```

Hinweis: `create or replace` behält die Grants aus 064 (nur service_role) — keine neuen Grants nötig.

- [ ] **Step 4: Alle Datenbanktests laufen lassen**

Run: `npx vitest run src/lib/kontoLoeschen.db.test.ts src/lib/mitgliedschaften.db.test.ts`
Expected: PASS. Der Test „lässt andere Konten unberührt“ (Bürgerkonto) bleibt grün: Vereine anderer Konten waren nie betroffen.

- [ ] **Step 5: Kopfkommentar von 064 ergänzen**

In `supabase/migrations/064_konto_loeschen.sql` nach Zeile 20 (`-- dort und in der Datenschutzerklärung (Ziffer 7) nachziehen.`) anfügen:

```sql
--
-- Ersetzt durch 065: Vereine und Gewerbe überleben das Konto (Mitgliedschaften).
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/064_konto_loeschen.sql supabase/migrations/065_mitgliedschaften.sql src/lib/kontoLoeschen.db.test.ts
git commit -m "feat: Kontoloeschung laesst Vereine und Vereinsbeitraege bestehen (Migration 065, Teil 5)"
```

---

### Task 8: Migration 065 einspielen und Typen erzeugen (Mensch)

**Files:**
- Modify: `src/types/supabase.ts` (generiert)

- [ ] **Step 1a: Vorabprüfung (Supabase-SQL-Editor)**

Jede Abfrage soll 0 Zeilen bzw. die erwarteten Werte liefern. Bei Treffern in V1, V3 oder V4: erst bereinigen, dann 065.

```sql
-- V1: Person mehreren Zielen zugeordnet (065 bricht sonst ab) — erwartet 0 Zeilen
select profile_id, count(*) from (select profile_id from public.vereine union all select profile_id from public.organisationen) x
 where profile_id is not null group by 1 having count(*) > 1;
-- V2: Constraint-Namen — erwartet: vereine_profile_id_key, vereine_profile_id_fkey,
--     organisationen_profile_id_fkey, posts_author_id_fkey (Namen müssen exakt so heißen)
select conrelid::regclass, conname, pg_get_constraintdef(oid) from pg_constraint
 where conrelid in ('public.vereine'::regclass,'public.organisationen'::regclass,'public.posts'::regclass)
   and (pg_get_constraintdef(oid) ilike '%profile_id%' or pg_get_constraintdef(oid) ilike '%author_id%');
-- V3: organisationen, die keine Gewerbe sind — erwartet nur typ = gewerbe
select typ, count(*) from public.organisationen group by typ;
-- V4: Rolle passt nicht zum Ziel — erwartet 0 Zeilen
select 'verein' t, v.id, p.id, p.role, v.typ from public.vereine v join public.profiles p on p.id = v.profile_id where p.role::text <> v.typ
union all
select 'gewerbe', o.id, p.id, p.role, o.typ::text from public.organisationen o join public.profiles p on p.id = o.profile_id where p.role::text <> 'gewerbe';
-- V5: einladungen-Spalten — erwartet verein_id, org_id, organisation_name, angenommen_am
select column_name from information_schema.columns where table_schema='public' and table_name='einladungen'
 and column_name in ('verein_id','org_id','organisation_name','angenommen_am','mitglied_rolle');
-- V6: rollen_log-Aktionen — erwartet Teilmenge von eingeladen, rolle_gesetzt, rolle_transfer, widerrufen
select aktion, count(*) from public.rollen_log group by aktion;
```

- [ ] **Step 1b: Mensch spielt 065 im Supabase-SQL-Editor ein**

Den gesamten Inhalt von `supabase/migrations/065_mitgliedschaften.sql` **zwischen `begin;` und `commit;`** ausführen. So wird bei einem Fehler mittendrin alles zurückgerollt.

- [ ] **Step 1c: Nachprüfung**

```sql
-- N1: Backfill vollständig (beide = 0)
select count(*) from public.vereine v where profile_id is not null and not exists (select 1 from public.mitgliedschaften m where m.verein_id = v.id);
select count(*) from public.organisationen o where profile_id is not null and not exists (select 1 from public.mitgliedschaften m where m.organisation_id = o.id);
-- N2: V2 erneut — kein UNIQUE mehr auf vereine.profile_id, alle drei FKs "ON DELETE SET NULL"
-- N3: Vereins-/Gewerbebeiträge ohne org_id (Restmenge bewerten; erscheinen nicht mehr im Vereins-Dashboard)
select channel, count(*) from public.posts where org_id is null and channel::text in ('verein','gewerbe') group by 1;
-- N4: Rolle passt zur Mitgliedschaft — erwartet 0 Zeilen
select p.id, p.role from public.profiles p join public.mitgliedschaften m on m.profile_id = p.id
 left join public.vereine v on v.id = m.verein_id
 where p.role::text <> coalesce(v.typ, 'gewerbe');
-- N5: Funktionsrechte — true nur bei service_role und nur für Funktionen ohne "_"-Präfix
select p.proname, r.rolname, has_function_privilege(r.rolname, p.oid, 'execute')
  from pg_proc p cross join (values ('anon'),('authenticated'),('service_role')) r(rolname)
 where p.pronamespace = 'public'::regnamespace
   and p.proname in ('_vereinsziel','_mitglieder_recht','_rollen_log','_weiterer_verwalter','_mitglied_eintragen',
     '_vereinszeile_anlegen','_pfad_anderweitig_genutzt','mitglied_hinzufuegen','mitglied_entfernen','mitglied_rolle_aendern',
     'verein_anlegen','einladung_einloesen','verein_dateipfade','verein_loeschen','konto_dateipfade','konto_loeschen')
 order by 1,2;
-- N6: rollen_log-Check enthält die neuen Aktionen
select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.rollen_log'::regclass and contype='c';
-- N7: Grants auf die neue Tabelle (authenticated: SELECT; service_role: SELECT/INSERT/UPDATE/DELETE)
select grantee, privilege_type from information_schema.role_table_grants where table_name='mitgliedschaften';
```

- [ ] **Step 2: Typen erzeugen**

Run: `npm run db:types`
Expected: `src/types/supabase.ts` enthält `mitgliedschaften` unter `Tables` und `mitglied_hinzufuegen`, `verein_anlegen`, `verein_loeschen`, … unter `Functions`; `p_verein_id?: string` ist optional.

- [ ] **Step 3: Typprüfung**

Run: `npx tsc --noEmit`
Expected: Fehler nur dort, wo Code `posts.author_id` als `string` (nicht `string | null`) erwartet. Jede Fundstelle mit `?? ''` oder einer `null`-Prüfung beheben, ohne Verhalten zu ändern. Danach: keine Fehler.

- [ ] **Step 4: Commit**

```bash
git add src/types/supabase.ts
git add -u src
git commit -m "build: Supabase-Typen fuer Mitgliedschaften"
```

---

### Task 9: `src/lib/mitgliedschaft.ts` — Typen und reine Helfer

**Files:**
- Create: `src/lib/mitgliedschaft.ts`
- Create: `src/lib/mitgliedschaft.test.ts`

- [ ] **Step 1: Failing test schreiben**

```ts
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
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `npx vitest run src/lib/mitgliedschaft.test.ts`
Expected: FAIL — `Cannot find module './mitgliedschaft'`

- [ ] **Step 3: Implementierung**

```ts
/**
 * Mitgliedschaften in Vereinen, Organisationen und Gewerben (Migration 065).
 *
 * Die Regeln selbst (wer darf was, letzter Verwalter, eine Person = ein Verein)
 * prüfen die SQL-Funktionen. Hier liegt nur, was die API-Routen zum Aufrufen und
 * Anzeigen brauchen.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { Profile } from '@/types/database'

export type MitgliedRolle = 'verwalter' | 'autor'
export type ZielTyp = 'verein' | 'organisation' | 'gewerbe'
/** Was die handelnde Person mit dem Ziel darf. */
export type ZielRecht = 'verwaltung' | MitgliedRolle

export interface Mitgliedschaft {
  rolle: MitgliedRolle
  verein_id: string | null
  organisation_id: string | null
}

export interface Ziel {
  verein_id: string | null
  organisation_id: string | null
  gemeinde_id: string
  name: string
  typ: ZielTyp
  recht: ZielRecht
}

export interface TeamMitglied {
  profile_id: string
  name: string
  email: string | null
  rolle: MitgliedRolle
  ich: boolean
}

export interface TeamEinladung {
  id: string
  email: string
  mitglied_rolle: MitgliedRolle
  ablauft_am: string
}

export interface TeamDaten {
  ziel: { verein_id: string | null; organisation_id: string | null; name: string; typ: ZielTyp }
  recht: ZielRecht
  mitglieder: TeamMitglied[]
  einladungen: TeamEinladung[]
  umfang: { beitraege: number; abonnenten: number }
}

type Service = SupabaseClient<Database>

const ALLGEMEINER_FEHLER = 'Die Aktion ist fehlgeschlagen. Bitte versuchen Sie es erneut.'

/** Übersetzt Fehler der SQL-Funktionen (Codes siehe Migration 065) in HTTP-Antworten. */
export function rpcFehler(error: { code?: string; message: string }): { status: number; meldung: string } {
  switch (error.code) {
    case '42501': return { status: 403, meldung: error.message }
    case 'P0001': return { status: 409, meldung: error.message }
    case 'P0002': return { status: 404, meldung: error.message }
    case '22023': return { status: 400, meldung: error.message }
    default:      return { status: 500, meldung: ALLGEMEINER_FEHLER }
  }
}

export function kurzname(
  p: { vorname?: string | null; nachname?: string | null; display_name?: string | null } | null,
): string | null {
  if (!p) return null
  if (p.vorname && p.nachname) return `${p.vorname} ${p.nachname.charAt(0)}.`
  return p.vorname || p.display_name || null
}

export async function meineMitgliedschaft(service: Service, profileId: string): Promise<Mitgliedschaft | null> {
  const { data, error } = await service
    .from('mitgliedschaften')
    .select('rolle, verein_id, organisation_id')
    .eq('profile_id', profileId)
    .maybeSingle()
  if (error) throw new Error(`Mitgliedschaft konnte nicht geladen werden: ${error.message}`)
  return data as Mitgliedschaft | null
}

/** Verein- bzw. Gewerbe-ID der eigenen Mitgliedschaft, wenn sie zur Art passt. */
export async function meinVereinsziel(
  service: Service,
  profileId: string,
  art: 'verein' | 'gewerbe',
): Promise<{ id: string; rolle: MitgliedRolle } | null> {
  const m = await meineMitgliedschaft(service, profileId)
  const id = art === 'verein' ? m?.verein_id : m?.organisation_id
  return m && id ? { id, rolle: m.rolle } : null
}

type ZielErgebnis = { ok: true; ziel: Ziel } | { ok: false; status: number; fehler: string }

/**
 * Welchen Verein bzw. welches Gewerbe meint die Anfrage?
 *   * Verwaltung/Super-Admin: aus der Angabe im Request, Gemeinde wird geprüft.
 *   * Mitglieder: immer die eigene Mitgliedschaft — eine Angabe im Request wird ignoriert.
 */
export async function bestimmeZiel(
  service: Service,
  profile: Pick<Profile, 'id' | 'role' | 'gemeinde_id'>,
  angabe: { verein_id?: string | null; organisation_id?: string | null },
): Promise<ZielErgebnis> {
  let verein_id: string | null = null
  let organisation_id: string | null = null
  let recht: ZielRecht

  if (profile.role === 'verwaltung' || profile.role === 'super_admin') {
    if (!!angabe.verein_id === !!angabe.organisation_id) {
      return { ok: false, status: 400, fehler: 'Bitte genau einen Verein oder ein Gewerbe angeben.' }
    }
    verein_id = angabe.verein_id ?? null
    organisation_id = angabe.organisation_id ?? null
    recht = 'verwaltung'
  } else {
    const m = await meineMitgliedschaft(service, profile.id)
    if (!m) return { ok: false, status: 404, fehler: 'Sie sind keinem Verein und keinem Gewerbe zugeordnet.' }
    verein_id = m.verein_id
    organisation_id = m.organisation_id
    recht = m.rolle
  }

  let gemeinde_id: string
  let name: string
  let typ: ZielTyp
  if (verein_id) {
    const { data } = await service.from('vereine').select('gemeinde_id, verein_name, typ').eq('id', verein_id).maybeSingle()
    if (!data) return { ok: false, status: 404, fehler: 'Verein nicht gefunden.' }
    gemeinde_id = data.gemeinde_id
    name = data.verein_name
    typ = data.typ === 'organisation' ? 'organisation' : 'verein'
  } else {
    const { data } = await service.from('organisationen').select('gemeinde_id, name').eq('id', organisation_id!).maybeSingle()
    if (!data) return { ok: false, status: 404, fehler: 'Gewerbe nicht gefunden.' }
    gemeinde_id = data.gemeinde_id
    name = data.name
    typ = 'gewerbe'
  }

  if (profile.role === 'verwaltung' && gemeinde_id !== profile.gemeinde_id) {
    return { ok: false, status: 404, fehler: 'Verein nicht gefunden.' }
  }

  return { ok: true, ziel: { verein_id, organisation_id, gemeinde_id, name, typ, recht } }
}

/** Mitglieder, offene Einladungen und Umfang eines Ziels (für den Bereich „Team“). */
export async function ladeTeam(service: Service, ziel: Ziel, ichId: string): Promise<TeamDaten> {
  const zielId = (ziel.verein_id ?? ziel.organisation_id)!
  const mitgliedSpalte = ziel.verein_id ? 'verein_id' : 'organisation_id'
  const einladungSpalte = ziel.verein_id ? 'verein_id' : 'org_id'

  const [mitglieder, einladungen, beitraege, abonnenten] = await Promise.all([
    service
      .from('mitgliedschaften')
      .select('profile_id, rolle, created_at, profiles!mitgliedschaften_profile_id_fkey(display_name, vorname, nachname, email)')
      .eq(mitgliedSpalte, zielId)
      .order('created_at'),
    service
      .from('einladungen')
      .select('id, email, mitglied_rolle, ablauft_am')
      .eq(einladungSpalte, zielId)
      .eq('status', 'offen')
      .order('erstellt_am'),
    service.from('posts').select('id', { count: 'exact', head: true }).eq('org_id', zielId),
    ziel.verein_id
      ? service.from('verein_abonnements').select('id', { count: 'exact', head: true }).eq('verein_id', zielId)
      : service.from('gewerbe_abonnements').select('id', { count: 'exact', head: true }).eq('gewerbe_id', zielId),
  ])

  if (mitglieder.error) throw new Error(`Mitglieder konnten nicht geladen werden: ${mitglieder.error.message}`)
  if (einladungen.error) throw new Error(`Einladungen konnten nicht geladen werden: ${einladungen.error.message}`)

  type Zeile = {
    profile_id: string
    rolle: MitgliedRolle
    profiles: { display_name: string | null; vorname: string | null; nachname: string | null; email: string | null } | null
  }

  return {
    ziel: { verein_id: ziel.verein_id, organisation_id: ziel.organisation_id, name: ziel.name, typ: ziel.typ },
    recht: ziel.recht,
    mitglieder: ((mitglieder.data ?? []) as unknown as Zeile[]).map(z => ({
      profile_id: z.profile_id,
      name: [z.profiles?.vorname, z.profiles?.nachname].filter(Boolean).join(' ')
        || z.profiles?.display_name
        || z.profiles?.email
        || 'Unbekannt',
      email: z.profiles?.email ?? null,
      rolle: z.rolle,
      ich: z.profile_id === ichId,
    })),
    einladungen: (einladungen.data ?? []).map(e => ({
      id: e.id,
      email: e.email,
      mitglied_rolle: (e.mitglied_rolle ?? 'autor') as MitgliedRolle,
      ablauft_am: e.ablauft_am,
    })),
    umfang: { beitraege: beitraege.count ?? 0, abonnenten: abonnenten.count ?? 0 },
  }
}

export interface VereinsEintrag {
  id: string
  name: string
  typ: ZielTyp
  mitglieder: number
  verwalter: number
}

/** Liste für die Verwaltung: Vereine/Organisationen und Gewerbe mit Mitgliederzahlen. */
export function vereinsEintraege(
  vereine: { id: string; verein_name: string; typ: string }[],
  gewerbe: { id: string; name: string }[],
  mitgliedschaften: { verein_id: string | null; organisation_id: string | null; rolle: string }[],
): VereinsEintrag[] {
  const zaehle = (id: string, spalte: 'verein_id' | 'organisation_id') => {
    const eigene = mitgliedschaften.filter(m => m[spalte] === id)
    return { mitglieder: eigene.length, verwalter: eigene.filter(m => m.rolle === 'verwalter').length }
  }
  return [
    ...vereine.map(v => ({
      id: v.id,
      name: v.verein_name,
      typ: (v.typ === 'organisation' ? 'organisation' : 'verein') as ZielTyp,
      ...zaehle(v.id, 'verein_id'),
    })),
    ...gewerbe.map(g => ({ id: g.id, name: g.name, typ: 'gewerbe' as ZielTyp, ...zaehle(g.id, 'organisation_id') })),
  ]
}
```

Hinweis zum Embed `profiles!mitgliedschaften_profile_id_fkey`: `mitgliedschaften` hat zwei Fremdschlüssel auf `profiles` (`profile_id`, `hinzugefuegt_von`), deshalb muss PostgREST den Namen bekommen. Der Name entsteht automatisch aus der Spaltendefinition in 065.

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run src/lib/mitgliedschaft.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/mitgliedschaft.ts src/lib/mitgliedschaft.test.ts
git commit -m "feat: Helfer fuer Mitgliedschaften (Ziel, Team, Fehlercodes)"
```

---

### Task 10: E-Mail-Vorlagen um Absender und Zusatz erweitern

Heute steht in allen Mails „die Gemeindeverwaltung … hat …“. Wenn ein Verein selbst einlädt oder entfernt, stimmt das nicht.

**Files:**
- Modify: `src/lib/email.ts`

- [ ] **Step 1: Escape-Helfer nach `function resend()` (Zeile 17) einfügen**

```ts
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** „die Gemeindeverwaltung X“ oder ein übergebener Absender wie „der Verein „TSV““. */
function absenderHtml(gemeindeName: string, absender?: string | null): string {
  return absender ? escapeHtml(absender) : `die Gemeindeverwaltung <strong>${gemeindeName}</strong>`
}
```

- [ ] **Step 2: `sendeEinladungsEmail` erweitern**

Parameter `absender?: string | null` hinzufügen (nach `hinweis`). Die Zeile

```ts
      <p>die Gemeindeverwaltung <strong>${params.gemeindeName}</strong> lädt Sie ein, sich bei Dorfly zu registrieren.</p>
```

ersetzen durch

```ts
      <p>${absenderHtml(params.gemeindeName, params.absender)} lädt Sie ein, sich bei Dorfly ${params.gemeindeName} zu registrieren.</p>
```

Zusätzlich im Template den Wert `params.organisationName` mit `escapeHtml(params.organisationName)` ausgeben.

- [ ] **Step 3: `sendeRollenentzugEmail` erweitern**

Parameter `absender?: string | null` und `zusatz?: string | null` hinzufügen. Die Zeile

```ts
      <p>die Gemeindeverwaltung <strong>${params.gemeindeName}</strong> hat Ihre Rolle in Dorfly geändert.</p>
```

ersetzen durch

```ts
      <p>${absenderHtml(params.gemeindeName, params.absender)} hat Ihre Rolle in Dorfly geändert.</p>
      ${params.zusatz ? `<p>${escapeHtml(params.zusatz)}</p>` : ''}
```

- [ ] **Step 4: `sendeRollenzuweisungEmail` erweitern**

Parameter `absender?: string | null` hinzufügen. Die Zeile

```ts
      <p>die Gemeindeverwaltung <strong>${params.gemeindeName}</strong> hat Ihnen eine neue Rolle zugewiesen.</p>
```

ersetzen durch

```ts
      <p>${absenderHtml(params.gemeindeName, params.absender)} hat Ihnen eine neue Rolle zugewiesen.</p>
```

und `params.organisationName` mit `escapeHtml(...)` ausgeben.

- [ ] **Step 5: Typprüfung und Commit**

Run: `npx tsc --noEmit`
Expected: keine Fehler (neue Parameter sind optional).

```bash
git add src/lib/email.ts
git commit -m "feat: Rollen-Mails nennen den tatsaechlichen Absender"
```

---

### Task 11: Ablauf „Mitglied per E-Mail hinzufügen oder einladen“

**Files:**
- Create: `src/lib/mitgliedHinzufuegen.ts`
- Create: `src/lib/mitgliedHinzufuegen.test.ts`

- [ ] **Step 1: Failing test schreiben**

```ts
import { describe, expect, it, vi } from 'vitest'
import { absenderFuer, mitgliedPerEmailHinzufuegen, type HinzufuegenDeps } from './mitgliedHinzufuegen'
import type { Ziel } from './mitgliedschaft'

const ZIEL: Ziel = {
  verein_id: 'v1', organisation_id: null, gemeinde_id: 'g1', name: 'TSV', typ: 'verein', recht: 'verwalter',
}
const GEMEINDE = { name: 'Ehningen', slug: 'ehningen' }

function deps(over: Partial<HinzufuegenDeps> = {}): HinzufuegenDeps {
  return {
    profilPerEmail: vi.fn(async () => null),
    mitgliedHinzufuegen: vi.fn(async () => ({ error: null })),
    einladungAnlegen: vi.fn(async () => ({ token: 'tok' })),
    sendeZuweisung: vi.fn(async () => undefined),
    sendeEinladung: vi.fn(async () => undefined),
    ...over,
  }
}

const eingabe = { email: ' Bert@Example.de ', rolle: 'autor' as const, ziel: ZIEL, akteurId: 'anna', gemeinde: GEMEINDE }

describe('mitgliedPerEmailHinzufuegen', () => {
  it('fügt ein bestehendes Konto direkt hinzu und benachrichtigt es', async () => {
    const d = deps({ profilPerEmail: vi.fn(async () => ({ id: 'bert', gemeinde_id: 'g1', display_name: 'Bert' })) })
    expect(await mitgliedPerEmailHinzufuegen(eingabe, d)).toEqual({ ok: true, art: 'hinzugefuegt' })
    expect(d.profilPerEmail).toHaveBeenCalledWith('bert@example.de')
    expect(d.mitgliedHinzufuegen).toHaveBeenCalledWith({
      p_profile_id: 'bert', p_rolle: 'autor', p_ausgefuehrt_von: 'anna', p_verein_id: 'v1', p_organisation_id: undefined,
    })
    expect(d.sendeZuweisung).toHaveBeenCalledWith(expect.objectContaining({
      to: 'bert@example.de', neueRolle: 'verein', organisationName: 'TSV', absender: 'der Verein „TSV“',
    }))
    expect(d.einladungAnlegen).not.toHaveBeenCalled()
  })

  it('gibt die Ablehnung der Datenbank weiter und schickt keine Mail', async () => {
    const d = deps({
      profilPerEmail: vi.fn(async () => ({ id: 'rat', gemeinde_id: 'g1', display_name: null })),
      mitgliedHinzufuegen: vi.fn(async () => ({ error: { code: 'P0001', message: 'Diese Person ist bereits einem Verein zugeordnet oder hat eine andere Rolle.' } })),
    })
    expect(await mitgliedPerEmailHinzufuegen(eingabe, d)).toEqual({
      ok: false, status: 409, fehler: 'Diese Person ist bereits einem Verein zugeordnet oder hat eine andere Rolle.',
    })
    expect(d.sendeZuweisung).not.toHaveBeenCalled()
  })

  it('lehnt Konten anderer Gemeinden ab', async () => {
    const d = deps({ profilPerEmail: vi.fn(async () => ({ id: 'x', gemeinde_id: 'g2', display_name: null })) })
    const e = await mitgliedPerEmailHinzufuegen(eingabe, d)
    expect(e).toMatchObject({ ok: false, status: 409 })
    expect(d.mitgliedHinzufuegen).not.toHaveBeenCalled()
  })

  it('lädt unbekannte Adressen ein — mit Ziel und Mitgliedsrolle', async () => {
    const d = deps()
    expect(await mitgliedPerEmailHinzufuegen(eingabe, d)).toEqual({ ok: true, art: 'eingeladen' })
    expect(d.einladungAnlegen).toHaveBeenCalledWith({
      email: 'bert@example.de', rolle: 'verein', mitglied_rolle: 'autor', verein_id: 'v1', org_id: null,
      organisation_name: 'TSV', gemeinde_id: 'g1', eingeladen_von: 'anna',
    })
    expect(d.sendeEinladung).toHaveBeenCalledWith(expect.objectContaining({
      to: 'bert@example.de', token: 'tok', rolle: 'verein', organisationName: 'TSV', gemeindeSlug: 'ehningen',
    }))
  })

  it('meldet einen Fehler beim Anlegen der Einladung', async () => {
    const d = deps({ einladungAnlegen: vi.fn(async () => ({ fehler: 'db down' })) })
    expect(await mitgliedPerEmailHinzufuegen(eingabe, d)).toMatchObject({ ok: false, status: 500 })
    expect(d.sendeEinladung).not.toHaveBeenCalled()
  })

  it('bleibt erfolgreich, wenn nur die Mail scheitert', async () => {
    const d = deps({ sendeEinladung: vi.fn(async () => { throw new Error('resend down') }) })
    expect(await mitgliedPerEmailHinzufuegen(eingabe, d)).toEqual({ ok: true, art: 'eingeladen' })
  })
})

describe('absenderFuer', () => {
  it('nennt die Verwaltung nicht ausdrücklich (Standardtext der Mail)', () => {
    expect(absenderFuer({ ...ZIEL, recht: 'verwaltung' })).toBeNull()
  })
  it('nennt Verein, Organisation oder Betrieb', () => {
    expect(absenderFuer(ZIEL)).toBe('der Verein „TSV“')
    expect(absenderFuer({ ...ZIEL, typ: 'organisation', name: 'Tafel' })).toBe('die Organisation „Tafel“')
    expect(absenderFuer({ ...ZIEL, typ: 'gewerbe', name: 'Bäckerei' })).toBe('der Betrieb „Bäckerei“')
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `npx vitest run src/lib/mitgliedHinzufuegen.test.ts`
Expected: FAIL — `Cannot find module './mitgliedHinzufuegen'`

- [ ] **Step 3: Implementierung**

```ts
/**
 * Mitglied per E-Mail hinzufügen.
 *
 * Hat die Adresse schon ein Konto in der Gemeinde, wird die Person sofort Mitglied
 * (die Datenbank prüft Rolle, Gemeinde und Rechte). Sonst geht eine Einladung raus;
 * beim Registrieren löst profilAnlegen sie über einladung_einloesen ein.
 */

import { rpcFehler, type MitgliedRolle, type Ziel } from './mitgliedschaft'

export interface HinzufuegenDeps {
  profilPerEmail(email: string): Promise<{ id: string; gemeinde_id: string | null; display_name: string | null } | null>
  mitgliedHinzufuegen(args: {
    p_profile_id: string
    p_rolle: MitgliedRolle
    p_ausgefuehrt_von: string
    p_verein_id?: string
    p_organisation_id?: string
  }): Promise<{ error: { code?: string; message: string } | null }>
  /** Widerruft offene Einladungen derselben Adresse und legt die neue an. */
  einladungAnlegen(daten: {
    email: string
    rolle: string
    mitglied_rolle: MitgliedRolle
    verein_id: string | null
    org_id: string | null
    organisation_name: string
    gemeinde_id: string
    eingeladen_von: string
  }): Promise<{ token: string } | { fehler: string }>
  sendeZuweisung(p: {
    to: string; name: string | null; gemeindeName: string; neueRolle: string; organisationName: string; absender: string | null
  }): Promise<unknown>
  sendeEinladung(p: {
    to: string; gemeindeName: string; gemeindeSlug: string; rolle: string; organisationName: string; token: string; absender: string | null
  }): Promise<unknown>
}

export interface HinzufuegenEingabe {
  email: string
  rolle: MitgliedRolle
  ziel: Ziel
  akteurId: string
  gemeinde: { name: string; slug: string }
}

export type HinzufuegenErgebnis =
  | { ok: true; art: 'hinzugefuegt' | 'eingeladen' }
  | { ok: false; status: number; fehler: string }

/** Absender für Mails; null = Standardtext „die Gemeindeverwaltung …“. */
export function absenderFuer(ziel: Ziel): string | null {
  if (ziel.recht === 'verwaltung') return null
  const art = ziel.typ === 'gewerbe' ? 'der Betrieb' : ziel.typ === 'organisation' ? 'die Organisation' : 'der Verein'
  return `${art} „${ziel.name}“`
}

async function mailOhneAbbruch(versand: () => Promise<unknown>, kontext: string) {
  try {
    await versand()
  } catch (e) {
    console.error(`[mitglieder] Mail fehlgeschlagen (${kontext}):`, e)
  }
}

export async function mitgliedPerEmailHinzufuegen(
  eingabe: HinzufuegenEingabe,
  deps: HinzufuegenDeps,
): Promise<HinzufuegenErgebnis> {
  const { ziel, rolle, akteurId, gemeinde } = eingabe
  const email = eingabe.email.trim().toLowerCase()
  const absender = absenderFuer(ziel)

  const profil = await deps.profilPerEmail(email)

  if (profil) {
    if (profil.gemeinde_id !== ziel.gemeinde_id) {
      return { ok: false, status: 409, fehler: 'Diese E-Mail-Adresse gehört zu einem Konto einer anderen Gemeinde.' }
    }
    const { error } = await deps.mitgliedHinzufuegen({
      p_profile_id: profil.id,
      p_rolle: rolle,
      p_ausgefuehrt_von: akteurId,
      p_verein_id: ziel.verein_id ?? undefined,
      p_organisation_id: ziel.organisation_id ?? undefined,
    })
    if (error) {
      const f = rpcFehler(error)
      return { ok: false, status: f.status, fehler: f.meldung }
    }
    await mailOhneAbbruch(() => deps.sendeZuweisung({
      to: email, name: profil.display_name, gemeindeName: gemeinde.name,
      neueRolle: ziel.typ, organisationName: ziel.name, absender,
    }), 'Zuweisung')
    return { ok: true, art: 'hinzugefuegt' }
  }

  const einladung = await deps.einladungAnlegen({
    email,
    rolle: ziel.typ,
    mitglied_rolle: rolle,
    verein_id: ziel.verein_id,
    org_id: ziel.organisation_id,
    organisation_name: ziel.name,
    gemeinde_id: ziel.gemeinde_id,
    eingeladen_von: akteurId,
  })
  if ('fehler' in einladung) {
    console.error('[mitglieder] Einladung konnte nicht angelegt werden:', einladung.fehler)
    return { ok: false, status: 500, fehler: 'Die Einladung konnte nicht angelegt werden. Bitte versuchen Sie es erneut.' }
  }

  await mailOhneAbbruch(() => deps.sendeEinladung({
    to: email, gemeindeName: gemeinde.name, gemeindeSlug: gemeinde.slug,
    rolle: ziel.typ, organisationName: ziel.name, token: einladung.token, absender,
  }), 'Einladung')

  return { ok: true, art: 'eingeladen' }
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run src/lib/mitgliedHinzufuegen.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/mitgliedHinzufuegen.ts src/lib/mitgliedHinzufuegen.test.ts
git commit -m "feat: Mitglied per E-Mail hinzufuegen oder einladen"
```

---

### Task 12: Ablauf „Verein löschen“

**Files:**
- Modify: `src/lib/kontoLoeschen.ts` (Dateien-Löschen auslagern)
- Create: `src/lib/vereinLoeschen.ts`
- Create: `src/lib/vereinLoeschen.test.ts`

- [ ] **Step 1: `entferneDateien` in `kontoLoeschen.ts` auslagern**

In `src/lib/kontoLoeschen.ts` nach `const STORAGE_BATCH = 1000` einfügen:

```ts
/** Löscht Pfade im Media-Bucket in Paketen. Gibt die Fehlermeldung zurück oder null. */
export async function entferneDateien(service: SupabaseClient<Database>, pfade: string[]): Promise<string | null> {
  for (let i = 0; i < pfade.length; i += STORAGE_BATCH) {
    const { error } = await service.storage.from(MEDIA_BUCKET).remove(pfade.slice(i, i + STORAGE_BATCH))
    if (error) return error.message
  }
  return null
}
```

und in `loescheKonto` die Schleife

```ts
  const liste = pfade ?? []
  for (let i = 0; i < liste.length; i += STORAGE_BATCH) {
    const { error } = await service.storage.from(MEDIA_BUCKET).remove(liste.slice(i, i + STORAGE_BATCH))
    if (error) return { ok: false, schritt: 'dateien', fehler: error.message }
  }
```

ersetzen durch

```ts
  const liste = pfade ?? []
  const dateiFehler = await entferneDateien(service, liste)
  if (dateiFehler) return { ok: false, schritt: 'dateien', fehler: dateiFehler }
```

Run: `npx vitest run src/lib/kontoLoeschen.test.ts`
Expected: PASS (Verhalten unverändert).

- [ ] **Step 2: Failing test für `loescheVerein` schreiben**

```ts
import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { loescheVerein } from './vereinLoeschen'
import type { Ziel } from './mitgliedschaft'

const ZIEL: Ziel = { verein_id: 'v1', organisation_id: null, gemeinde_id: 'g1', name: 'TSV', typ: 'verein', recht: 'verwalter' }

function erzeugeService(opts: { pfade?: string[]; storageFehler?: string; dbFehler?: { code: string; message: string } } = {}) {
  const aufrufe: string[] = []
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    aufrufe.push(`rpc:${name}`)
    if (name === 'verein_dateipfade') return { data: opts.pfade ?? [], error: null }
    if (opts.dbFehler) return { data: null, error: opts.dbFehler }
    expect(args).toMatchObject({ p_ausgefuehrt_von: 'anna', p_verein_id: 'v1' })
    return { data: [{ mitglied_id: 'bert', mitglied_email: 'bert@example.de', mitglied_name: 'Bert' }], error: null }
  })
  const remove = vi.fn(async (p: string[]) => {
    aufrufe.push(`storage:${p.length}`)
    return { data: [], error: opts.storageFehler ? { message: opts.storageFehler } : null }
  })
  const service = { rpc, storage: { from: () => ({ remove }) } } as unknown as SupabaseClient<Database>
  return { service, aufrufe }
}

describe('loescheVerein', () => {
  it('löscht erst Dateien, dann die Datenbank, und liefert die übrigen Mitglieder', async () => {
    const { service, aufrufe } = erzeugeService({ pfade: ['posts/a.jpg'] })
    const e = await loescheVerein(ZIEL, 'anna', service)
    expect(e).toEqual({ ok: true, betroffene: [{ id: 'bert', email: 'bert@example.de', name: 'Bert' }] })
    expect(aufrufe).toEqual(['rpc:verein_dateipfade', 'storage:1', 'rpc:verein_loeschen'])
  })

  it('verweigert Autoren, bevor irgendetwas gelöscht wird', async () => {
    const { service, aufrufe } = erzeugeService()
    expect(await loescheVerein({ ...ZIEL, recht: 'autor' }, 'bert', service)).toMatchObject({ ok: false, status: 403 })
    expect(aufrufe).toEqual([])
  })

  it('bricht ab, wenn Dateien nicht gelöscht werden können', async () => {
    const { service, aufrufe } = erzeugeService({ pfade: ['x'], storageFehler: 'nope' })
    expect(await loescheVerein(ZIEL, 'anna', service)).toMatchObject({ ok: false, status: 500 })
    expect(aufrufe).not.toContain('rpc:verein_loeschen')
  })

  it('übersetzt Datenbankfehler', async () => {
    const { service } = erzeugeService({ dbFehler: { code: '42501', message: 'Keine Berechtigung.' } })
    expect(await loescheVerein(ZIEL, 'anna', service)).toEqual({ ok: false, status: 403, fehler: 'Keine Berechtigung.' })
  })
})
```

- [ ] **Step 3: Test laufen lassen, Fehlschlag prüfen**

Run: `npx vitest run src/lib/vereinLoeschen.test.ts`
Expected: FAIL — `Cannot find module './vereinLoeschen'`

- [ ] **Step 4: Implementierung**

```ts
/**
 * Verein, Organisation oder Gewerbe löschen — Ablauf wie bei der Kontolöschung:
 * Dateien zuerst (wiederholbar), dann die Datenbank in einer Transaktion
 * (verein_loeschen, Migration 065). Scheitert ein Schritt, besteht der Verein noch.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { entferneDateien } from './kontoLoeschen'
import { rpcFehler, type Ziel } from './mitgliedschaft'

export type VereinLoeschErgebnis =
  | { ok: true; betroffene: { id: string; email: string | null; name: string | null }[] }
  | { ok: false; status: number; fehler: string }

const ALLGEMEIN = 'Der Verein konnte nicht gelöscht werden. Bitte versuchen Sie es erneut.'

export async function loescheVerein(
  ziel: Ziel,
  akteurId: string,
  service: SupabaseClient<Database>,
): Promise<VereinLoeschErgebnis> {
  if (ziel.recht === 'autor') return { ok: false, status: 403, fehler: 'Nur Verwalter können den Verein löschen.' }

  const zielArgs = {
    p_verein_id: ziel.verein_id ?? undefined,
    p_organisation_id: ziel.organisation_id ?? undefined,
  }

  const { data: pfade, error: pfadFehler } = await service.rpc('verein_dateipfade', zielArgs)
  if (pfadFehler) {
    console.error('[verein-loeschen] Dateipfade:', pfadFehler.message)
    return { ok: false, status: 500, fehler: ALLGEMEIN }
  }

  const dateiFehler = await entferneDateien(service, pfade ?? [])
  if (dateiFehler) {
    console.error('[verein-loeschen] Dateien:', dateiFehler)
    return { ok: false, status: 500, fehler: ALLGEMEIN }
  }

  const { data, error } = await service.rpc('verein_loeschen', { p_ausgefuehrt_von: akteurId, ...zielArgs })
  if (error) {
    const f = rpcFehler(error)
    return { ok: false, status: f.status, fehler: f.meldung }
  }

  return {
    ok: true,
    betroffene: (data ?? []).map(z => ({ id: z.mitglied_id, email: z.mitglied_email, name: z.mitglied_name })),
  }
}
```

- [ ] **Step 5: Tests laufen lassen**

Run: `npx vitest run src/lib/vereinLoeschen.test.ts src/lib/kontoLoeschen.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/kontoLoeschen.ts src/lib/vereinLoeschen.ts src/lib/vereinLoeschen.test.ts
git commit -m "feat: Ablauf zum Loeschen eines Vereins oder Gewerbes"
```

---

### Task 13: Validierungs-Schemas

**Files:**
- Modify: `src/lib/validations.ts:346-375`

- [ ] **Step 1: Schemas nach `rolleZuweisenSchema` einfügen**

```ts
// ── Mitglieder von Vereinen, Organisationen und Gewerben ─────────────────────

const mitgliedRolle = z.enum(['verwalter', 'autor'])

/** Nur für Verwaltung/Super-Admin ausgewertet; Mitglieder handeln immer für den eigenen Verein. */
const zielAngabe = {
  verein_id: uuid.optional(),
  organisation_id: uuid.optional(),
}

export const mitgliedHinzufuegenSchema = z.object({
  ...zielAngabe,
  email: z.email('Ungültige E-Mail'),
  rolle: mitgliedRolle,
})

export const mitgliedRolleAendernSchema = z.object({
  profile_id: uuid,
  rolle: mitgliedRolle,
})

export const mitgliedEntfernenSchema = z.object({
  profile_id: uuid,
})

export const mitgliedEinladungZurueckziehenSchema = z.object({
  ...zielAngabe,
  einladung_id: uuid,
})

export const vereinLoeschenSchema = z.object({
  ...zielAngabe,
  bestaetigung: z.string().min(1, 'Bitte den Namen eintippen.'),
})
```

- [ ] **Step 2: Transfer-Felder aus `rolleZuweisenSchema` entfernen**

In `rolleZuweisenSchema` die Zeilen `verein_id: uuid.optional(),` und `org_id: uuid.optional(),` löschen. (`einladungenSendenSchema` bleibt unverändert.)

- [ ] **Step 3: Typprüfung und Commit**

Run: `npx tsc --noEmit`
Expected: Fehler nur in `src/app/api/verwaltung/nutzer/rolle/route.ts` (Destructuring von `verein_id`, `org_id`) — wird in Task 19 behoben. Sonst keine.

```bash
git add src/lib/validations.ts
git commit -m "feat: Validierung fuer Mitglieder-Routen"
```

---

### Task 14: API `/api/mitglieder`

**Files:**
- Create: `src/app/api/mitglieder/route.ts`

- [ ] **Step 1: Route schreiben**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, apiError } from '@/lib/api'
import { createServiceClient } from '@/lib/supabase/server'
import {
  validate, mitgliedHinzufuegenSchema, mitgliedRolleAendernSchema, mitgliedEntfernenSchema,
} from '@/lib/validations'
import { bestimmeZiel, ladeTeam, rpcFehler } from '@/lib/mitgliedschaft'
import { mitgliedPerEmailHinzufuegen } from '@/lib/mitgliedHinzufuegen'
import { sendeEinladungsEmail, sendeRollenentzugEmail, sendeRollenzuweisungEmail } from '@/lib/email'
import type { UserRole } from '@/types/database'

// Rechte prüfen die SQL-Funktionen (Migration 065). Die Akteur-ID kommt immer aus
// der Session; Mitglieder handeln immer für den eigenen Verein.
const ROLLEN: UserRole[] = ['verein', 'organisation', 'gewerbe', 'verwaltung', 'super_admin']

// GET /api/mitglieder[?verein_id=…|organisation_id=…] — Team des Vereins
export const GET = withAuth(async (req: NextRequest, { profile }) => {
  const service = await createServiceClient()
  const ziel = await bestimmeZiel(service, profile, {
    verein_id: req.nextUrl.searchParams.get('verein_id'),
    organisation_id: req.nextUrl.searchParams.get('organisation_id'),
  })
  if (!ziel.ok) return apiError(ziel.fehler, ziel.status)
  return NextResponse.json(await ladeTeam(service, ziel.ziel, profile.id))
}, { roles: ROLLEN })

// POST /api/mitglieder — Person per E-Mail hinzufügen oder einladen
export const POST = withAuth(async (req: NextRequest, { profile }) => {
  const v = validate(mitgliedHinzufuegenSchema, await req.json())
  if (!v.success) return v.error

  const service = await createServiceClient()
  const ziel = await bestimmeZiel(service, profile, v.data)
  if (!ziel.ok) return apiError(ziel.fehler, ziel.status)
  if (ziel.ziel.recht === 'autor') return apiError('Nur Verwalter können Personen hinzufügen.', 403)

  const { data: gemeinde } = await service.from('gemeinden').select('name, slug').eq('id', ziel.ziel.gemeinde_id).single()
  if (!gemeinde) return apiError('Gemeinde nicht gefunden', 404)

  const ergebnis = await mitgliedPerEmailHinzufuegen(
    { email: v.data.email, rolle: v.data.rolle, ziel: ziel.ziel, akteurId: profile.id, gemeinde },
    {
      profilPerEmail: async email => {
        const { data } = await service.from('profiles').select('id, gemeinde_id, display_name').eq('email', email).maybeSingle()
        return data
      },
      mitgliedHinzufuegen: args => service.rpc('mitglied_hinzufuegen', args),
      einladungAnlegen: async daten => {
        await service
          .from('einladungen')
          .update({ status: 'widerrufen' })
          .eq('email', daten.email)
          .eq('gemeinde_id', daten.gemeinde_id)
          .eq('status', 'offen')
        const { data, error } = await service.from('einladungen').insert(daten).select('token').single()
        if (error || !data) return { fehler: error?.message ?? 'unbekannt' }
        await service.from('rollen_log').insert({
          gemeinde_id: daten.gemeinde_id,
          aktion: 'eingeladen',
          ziel_email: daten.email,
          neue_rolle: daten.rolle,
          ausgefuehrt_von: profile.id,
        })
        return { token: data.token }
      },
      sendeZuweisung: p => sendeRollenzuweisungEmail(p),
      sendeEinladung: p => sendeEinladungsEmail(p),
    },
  )

  if (!ergebnis.ok) return apiError(ergebnis.fehler, ergebnis.status)
  return NextResponse.json(ergebnis)
}, { roles: ROLLEN })

// PATCH /api/mitglieder — Mitgliedsrolle ändern
export const PATCH = withAuth(async (req: NextRequest, { profile }) => {
  const v = validate(mitgliedRolleAendernSchema, await req.json())
  if (!v.success) return v.error

  const service = await createServiceClient()
  const { error } = await service.rpc('mitglied_rolle_aendern', {
    p_profile_id: v.data.profile_id,
    p_rolle: v.data.rolle,
    p_ausgefuehrt_von: profile.id,
  })
  if (error) {
    const f = rpcFehler(error)
    return apiError(f.meldung, f.status)
  }
  return NextResponse.json({ ok: true })
}, { roles: ROLLEN })

// DELETE /api/mitglieder — Mitglied entfernen; mit der eigenen ID: austreten
export const DELETE = withAuth(async (req: NextRequest, { profile }) => {
  const v = validate(mitgliedEntfernenSchema, await req.json())
  if (!v.success) return v.error

  const service = await createServiceClient()

  // Für die Mail vorher lesen — nach dem Entfernen ist die Zuordnung weg
  const ziel = await bestimmeZiel(service, profile, {})
  const { data: person } = await service
    .from('profiles')
    .select('email, display_name, role, gemeinde_id, gemeinden(name)')
    .eq('id', v.data.profile_id)
    .maybeSingle()

  const { error } = await service.rpc('mitglied_entfernen', {
    p_profile_id: v.data.profile_id,
    p_ausgefuehrt_von: profile.id,
  })
  if (error) {
    const f = rpcFehler(error)
    return apiError(f.meldung, f.status)
  }

  // Wer selbst austritt, bekommt keine Mail
  if (person?.email && v.data.profile_id !== profile.id) {
    const gemeindeName = (person.gemeinden as { name: string } | null)?.name ?? ''
    try {
      await sendeRollenentzugEmail({
        to: person.email,
        name: person.display_name,
        gemeindeName,
        alteRolle: person.role,
        absender: ziel.ok && ziel.ziel.recht !== 'verwaltung' ? `der Verein „${ziel.ziel.name}“` : null,
      })
    } catch (e) {
      console.error('[mitglieder] Mail beim Entfernen fehlgeschlagen:', e)
    }
  }

  return NextResponse.json({ ok: true })
}, { roles: ROLLEN })
```

- [ ] **Step 2: Typprüfung**

Run: `npx tsc --noEmit`
Expected: keine neuen Fehler in `src/app/api/mitglieder/`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/mitglieder/route.ts
git commit -m "feat: API fuer Mitglieder (anzeigen, hinzufuegen, Rolle aendern, entfernen)"
```

---

### Task 15: API Einladung zurückziehen und Verein löschen

**Files:**
- Create: `src/app/api/mitglieder/einladung/route.ts`
- Create: `src/app/api/mitglieder/verein/route.ts`

- [ ] **Step 1: Einladung zurückziehen**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, apiError } from '@/lib/api'
import { createServiceClient } from '@/lib/supabase/server'
import { validate, mitgliedEinladungZurueckziehenSchema } from '@/lib/validations'
import { bestimmeZiel } from '@/lib/mitgliedschaft'

// DELETE /api/mitglieder/einladung — offene Einladung in den eigenen Verein zurückziehen
export const DELETE = withAuth(async (req: NextRequest, { profile }) => {
  const v = validate(mitgliedEinladungZurueckziehenSchema, await req.json())
  if (!v.success) return v.error

  const service = await createServiceClient()
  const ziel = await bestimmeZiel(service, profile, v.data)
  if (!ziel.ok) return apiError(ziel.fehler, ziel.status)
  if (ziel.ziel.recht === 'autor') return apiError('Nur Verwalter können Einladungen zurückziehen.', 403)

  const spalte = ziel.ziel.verein_id ? 'verein_id' : 'org_id'
  const zielId = (ziel.ziel.verein_id ?? ziel.ziel.organisation_id)!

  const { data, error } = await service
    .from('einladungen')
    .update({ status: 'widerrufen' })
    .eq('id', v.data.einladung_id)
    .eq(spalte, zielId)
    .eq('status', 'offen')
    .select('email')
    .maybeSingle()

  if (error) return apiError('Die Einladung konnte nicht zurückgezogen werden.')
  if (!data) return apiError('Einladung nicht gefunden', 404)

  await service.from('rollen_log').insert({
    gemeinde_id: ziel.ziel.gemeinde_id,
    aktion: 'widerrufen',
    ziel_email: data.email,
    einladung_id: v.data.einladung_id,
    ausgefuehrt_von: profile.id,
  })

  return NextResponse.json({ ok: true })
}, { roles: ['verein', 'organisation', 'gewerbe', 'verwaltung', 'super_admin'] })
```

- [ ] **Step 2: Verein löschen**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, apiError } from '@/lib/api'
import { createServiceClient } from '@/lib/supabase/server'
import { validate, vereinLoeschenSchema } from '@/lib/validations'
import { bestimmeZiel } from '@/lib/mitgliedschaft'
import { loescheVerein } from '@/lib/vereinLoeschen'
import { sendeRollenentzugEmail } from '@/lib/email'

// DELETE /api/mitglieder/verein — Verein, Organisation oder Gewerbe endgültig löschen.
// Bestätigung: der exakte Name muss mitgeschickt werden.
export const DELETE = withAuth(async (req: NextRequest, { profile }) => {
  const v = validate(vereinLoeschenSchema, await req.json())
  if (!v.success) return v.error

  const service = await createServiceClient()
  const ziel = await bestimmeZiel(service, profile, v.data)
  if (!ziel.ok) return apiError(ziel.fehler, ziel.status)

  if (v.data.bestaetigung.trim() !== ziel.ziel.name.trim()) {
    return apiError('Der eingegebene Name stimmt nicht überein.', 400)
  }

  const ergebnis = await loescheVerein(ziel.ziel, profile.id, service)
  if (!ergebnis.ok) {
    console.error('[verein-loeschen] abgebrochen', { profileId: profile.id, ziel: ziel.ziel, fehler: ergebnis.fehler })
    return apiError(ergebnis.fehler, ergebnis.status)
  }

  const { data: gemeinde } = await service.from('gemeinden').select('name').eq('id', ziel.ziel.gemeinde_id).single()
  for (const person of ergebnis.betroffene) {
    if (!person.email) continue
    try {
      await sendeRollenentzugEmail({
        to: person.email,
        name: person.name,
        gemeindeName: gemeinde?.name ?? '',
        alteRolle: ziel.ziel.typ,
        absender: ziel.ziel.recht === 'verwaltung' ? null : `der Verein „${ziel.ziel.name}“`,
        zusatz: `Der Eintrag „${ziel.ziel.name}“ wurde gelöscht.`,
      })
    } catch (e) {
      console.error('[verein-loeschen] Mail fehlgeschlagen:', e)
    }
  }

  return NextResponse.json({ ok: true })
}, { roles: ['verein', 'organisation', 'gewerbe', 'verwaltung', 'super_admin'] })
```

- [ ] **Step 3: Typprüfung und Commit**

Run: `npx tsc --noEmit`
Expected: keine neuen Fehler.

```bash
git add src/app/api/mitglieder/einladung/route.ts src/app/api/mitglieder/verein/route.ts
git commit -m "feat: API zum Zurueckziehen von Einladungen und Loeschen eines Vereins"
```

---

### Task 16: Vereins-Routen auf Mitgliedschaft umstellen

**Files:**
- Modify: `src/app/api/verein/profil/route.ts` (komplett)
- Modify: `src/app/api/verein/post/route.ts:17-28`, `:76-86`, `:118-134`

- [ ] **Step 1: `verein/profil/route.ts` ersetzen**

```ts
import { withAuth, apiError } from '@/lib/api'
import { validate, vereinProfilErstellenSchema, vereinProfilAktualisierenSchema } from '@/lib/validations'
import { createServiceClient } from '@/lib/supabase/server'
import { meineMitgliedschaft, meinVereinsziel, rpcFehler } from '@/lib/mitgliedschaft'
import { NextResponse } from 'next/server'

// Selbstanlage: Person mit Rolle verein/organisation, die noch keinem Verein angehört.
export const POST = withAuth(
  async (req, { profile }) => {
    if (!profile.gemeinde_id) {
      return NextResponse.json({ error: 'Keine Gemeinde zugeordnet' }, { status: 400 })
    }

    const v = validate(vereinProfilErstellenSchema, await req.json())
    if (!v.success) return v.error

    const service = await createServiceClient()
    if (await meineMitgliedschaft(service, profile.id)) {
      return NextResponse.json({ error: 'Profil bereits vorhanden' }, { status: 409 })
    }

    const { data: vereinId, error: anlegeFehler } = await service.rpc('verein_anlegen', {
      p_profile_id: profile.id,
      p_typ: profile.role === 'organisation' ? 'organisation' : 'verein',
      p_name: v.data.verein_name,
      p_ausgefuehrt_von: profile.id,
    })
    if (anlegeFehler || !vereinId) {
      const f = rpcFehler(anlegeFehler ?? { message: 'kein Ergebnis' })
      return apiError(f.meldung, f.status)
    }

    const { data: verein, error } = await service
      .from('vereine')
      .update({
        kategorie_id: v.data.kategorie_id ?? null,
        beschreibung: v.data.beschreibung ?? null,
        website: v.data.website || null,
        logo_url: v.data.logo_url ?? null,
      })
      .eq('id', vereinId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ verein })
  },
  { roles: ['verein', 'organisation'] },
)

export const PATCH = withAuth(
  async (req, { profile }) => {
    const v = validate(vereinProfilAktualisierenSchema, await req.json())
    if (!v.success) return v.error

    const service = await createServiceClient()
    const m = await meinVereinsziel(service, profile.id, 'verein')
    if (!m || m.id !== v.data.vereinId) return apiError('Verein nicht gefunden', 404)
    if (m.rolle !== 'verwalter') return apiError('Nur Verwalter können das Profil bearbeiten.', 403)

    const { data: verein, error } = await service
      .from('vereine')
      .update({
        verein_name: v.data.verein_name,
        kategorie_id: v.data.kategorie_id ?? null,
        beschreibung: v.data.beschreibung ?? null,
        website: v.data.website || null,
        logo_url: v.data.logo_url ?? null,
      })
      .eq('id', m.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ verein })
  },
  { roles: ['verein', 'organisation'] },
)
```

- [ ] **Step 2: `verein/post/route.ts` — POST**

Import ergänzen: `import { meinVereinsziel } from '@/lib/mitgliedschaft'`.

Den Block

```ts
    const supabase = await createClient()

    const { data: verein, error: fetchError } = await supabase
      .from('vereine')
      .select('id, gemeinde_id')
      .eq('id', vereinId)
      .eq('profile_id', profile.id)
      .single()

    if (fetchError || !verein) {
      return NextResponse.json({ error: 'Verein nicht gefunden' }, { status: 404 })
    }

    const service = await createServiceClient()
```

ersetzen durch

```ts
    const service = await createServiceClient()

    const m = await meinVereinsziel(service, profile.id, 'verein')
    const { data: verein } = m && m.id === vereinId
      ? await service.from('vereine').select('id, gemeinde_id').eq('id', vereinId).single()
      : { data: null }

    if (!verein) {
      return NextResponse.json({ error: 'Verein nicht gefunden' }, { status: 404 })
    }
```

- [ ] **Step 3: `verein/post/route.ts` — PATCH**

Den Block

```ts
    const supabase = await createClient()
    const service = await createServiceClient()

    const { data: existing, error: fetchError } = await supabase
      .from('posts')
      .select('id, tag')
      .eq('id', postId)
      .eq('author_id', profile.id)
      .single()
```

ersetzen durch

```ts
    const service = await createServiceClient()
    const m = await meinVereinsziel(service, profile.id, 'verein')
    if (!m) return NextResponse.json({ error: 'Beitrag nicht gefunden' }, { status: 404 })

    // Alle Mitglieder dürfen alle Beiträge ihres Vereins bearbeiten
    const { data: existing, error: fetchError } = await service
      .from('posts')
      .select('id, tag')
      .eq('id', postId)
      .eq('org_id', m.id)
      .eq('channel', 'verein')
      .single()
```

- [ ] **Step 4: `verein/post/route.ts` — DELETE**

```ts
    const service = await createServiceClient()

    const { error } = await service
      .from('posts')
      .delete()
      .eq('id', v.data.postId)
      .eq('author_id', profile.id)
```

ersetzen durch

```ts
    const service = await createServiceClient()
    const m = await meinVereinsziel(service, profile.id, 'verein')
    if (!m) return NextResponse.json({ error: 'Beitrag nicht gefunden' }, { status: 404 })

    const { error } = await service
      .from('posts')
      .delete()
      .eq('id', v.data.postId)
      .eq('org_id', m.id)
      .eq('channel', 'verein')
```

Den nicht mehr genutzten Import `createClient` entfernen (`import { createServiceClient } from '@/lib/supabase/server'`).

- [ ] **Step 5: Typprüfung, Lint, Commit**

Run: `npx tsc --noEmit && npx eslint src/app/api/verein`
Expected: keine Fehler.

```bash
git add src/app/api/verein
git commit -m "feat: Vereinsrouten pruefen Rechte ueber die Mitgliedschaft"
```

---

### Task 17: Gewerbe-Routen auf Mitgliedschaft umstellen

**Files:**
- Modify: `src/app/api/gewerbe/betrieb/route.ts:20-62`
- Modify: `src/app/api/gewerbe/profil/route.ts` (komplett)
- Modify: `src/app/api/gewerbe/post/route.ts`

- [ ] **Step 1: `gewerbe/betrieb/route.ts` — Handler ersetzen**

Imports: `import { withAuth, apiError } from '@/lib/api'`, `import { createServiceClient } from '@/lib/supabase/server'`, `import { meineMitgliedschaft, rpcFehler } from '@/lib/mitgliedschaft'`. `erstellenSchema` bleibt. Den Handler ab `const supabase = await createClient()` bis zum Ende des Handlers ersetzen durch:

```ts
    const service = await createServiceClient()

    if (await meineMitgliedschaft(service, profile.id)) {
      return NextResponse.json({ error: 'Betrieb bereits vorhanden' }, { status: 409 })
    }

    const { data: betriebId, error: anlegeFehler } = await service.rpc('verein_anlegen', {
      p_profile_id: profile.id,
      p_typ: 'gewerbe',
      p_name: v.data.name,
      p_ausgefuehrt_von: profile.id,
    })
    if (anlegeFehler || !betriebId) {
      const f = rpcFehler(anlegeFehler ?? { message: 'kein Ergebnis' })
      return apiError(f.meldung, f.status)
    }

    const { data: betrieb, error } = await service
      .from('organisationen')
      .update({
        branche_id: v.data.branche_id ?? null,
        beschreibung: v.data.beschreibung ?? null,
        adresse: v.data.adresse ?? null,
        oeffnungszeiten: v.data.oeffnungszeiten ?? null,
        website: v.data.website || null,
        logo_url: v.data.logo_url ?? null,
      })
      .eq('id', betriebId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ betrieb })
```

- [ ] **Step 2: `gewerbe/profil/route.ts` ersetzen**

```ts
import { withAuth, apiError } from '@/lib/api'
import { validate, gewerbeProfilSchema } from '@/lib/validations'
import { createServiceClient } from '@/lib/supabase/server'
import { meinVereinsziel } from '@/lib/mitgliedschaft'
import { NextResponse } from 'next/server'

export const PATCH = withAuth(
  async (req, { profile }) => {
    const v = validate(gewerbeProfilSchema, await req.json())
    if (!v.success) return v.error

    const { gewerbeId, name, branche_id, beschreibung, adresse, oeffnungszeiten, website, logo_url } = v.data

    const service = await createServiceClient()
    const m = await meinVereinsziel(service, profile.id, 'gewerbe')
    if (!m || m.id !== gewerbeId) return apiError('Gewerbe nicht gefunden', 404)
    if (m.rolle !== 'verwalter') return apiError('Nur Verwalter können das Profil bearbeiten.', 403)

    const { data: updated, error } = await service
      .from('organisationen')
      .update({
        name,
        branche_id: branche_id ?? null,
        beschreibung: beschreibung ?? null,
        adresse: adresse ?? null,
        oeffnungszeiten: oeffnungszeiten ?? null,
        website: website || null,
        logo_url: logo_url ?? null,
      })
      .eq('id', m.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ betrieb: updated })
  },
  { roles: ['gewerbe'] },
)
```

- [ ] **Step 3: `gewerbe/post/route.ts` — POST**

Import: `import { meinVereinsziel } from '@/lib/mitgliedschaft'`. Den Block von `const supabase = await createClient()` bis einschließlich `const service = await createServiceClient()` ersetzen durch:

```ts
    const service = await createServiceClient()

    // Mitgliedschaft + Plan laden
    const m = await meinVereinsziel(service, profile.id, 'gewerbe')
    const { data: betrieb } = m && m.id === gewerbeId
      ? await service.from('organisationen').select('id, plan, gemeinde_id').eq('id', gewerbeId).eq('typ', 'gewerbe').single()
      : { data: null }

    if (!betrieb) {
      return NextResponse.json({ error: 'Gewerbe nicht gefunden' }, { status: 404 })
    }

    // Wochenlimit gilt für den Betrieb, nicht für die einzelne Person
    if (betrieb.plan === 'standard') {
      const wochenstart = getWochenstart().toISOString()
      const { count } = await service
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', betrieb.id)
        .eq('channel', 'gewerbe')
        .gte('published_at', wochenstart)

      if ((count ?? 0) >= 1) {
        return NextResponse.json(
          { error: 'Wochenlimit erreicht', naechsterMontag: getNaechstenMontag() },
          { status: 429 },
        )
      }
    }
```

- [ ] **Step 4: `gewerbe/post/route.ts` — PATCH und DELETE**

PATCH: Den Block

```ts
    const supabase = await createClient()

    const { data: existing, error: fetchError } = await supabase
      .from('posts')
      .select('id')
      .eq('id', postId)
      .eq('author_id', profile.id)
      .eq('channel', 'gewerbe')
      .single()
```

ersetzen durch

```ts
    const service = await createServiceClient()
    const m = await meinVereinsziel(service, profile.id, 'gewerbe')
    if (!m) return NextResponse.json({ error: 'Beitrag nicht gefunden' }, { status: 404 })

    const { data: existing, error: fetchError } = await service
      .from('posts')
      .select('id')
      .eq('id', postId)
      .eq('org_id', m.id)
      .eq('channel', 'gewerbe')
      .single()
```

und die nachfolgende Zeile `const service = await createServiceClient()` im PATCH löschen (jetzt doppelt).

DELETE: nach `const service = await createServiceClient()` einfügen

```ts
    const m = await meinVereinsziel(service, profile.id, 'gewerbe')
    if (!m) return NextResponse.json({ error: 'Beitrag nicht gefunden' }, { status: 404 })
```

und `.eq('author_id', profile.id)` durch `.eq('org_id', m.id)` ersetzen.

Import `createClient` entfernen.

- [ ] **Step 5: Typprüfung, Lint, Commit**

Run: `npx tsc --noEmit && npx eslint src/app/api/gewerbe`
Expected: keine Fehler.

```bash
git add src/app/api/gewerbe
git commit -m "feat: Gewerberouten pruefen Rechte ueber die Mitgliedschaft"
```

---

### Task 18: Einladung beim Registrieren einlösen

**Files:**
- Modify: `src/lib/profil-anlegen.ts:125-153`

- [ ] **Step 1: Block ersetzen**

Den gesamten Block innerhalb von `if (einladungId && einladungDetails) {`, beginnend mit `if (einladungDetails.rolle === 'verein') {` bis vor `await serviceClient.from('rollen_log').insert({`, ersetzen durch:

```ts
    if (['verein', 'organisation', 'gewerbe'].includes(einladungDetails.rolle)) {
      // Mitgliedschaft im eingeladenen Verein bzw. neuen Verein aus organisation_name
      // (Migration 065). Rolle 'organisation' landet dabei immer in vereine.
      const { error: einloeseFehler } = await serviceClient.rpc('einladung_einloesen', {
        p_profile_id: userId,
        p_einladung_id: einladungId,
      })
      if (einloeseFehler) {
        // Kein Abbruch: Das Konto besteht schon. Ohne Verein kann die Person ihn im
        // Dashboard selbst anlegen, oder die Verwaltung ordnet sie zu.
        console.error('[profilAnlegen] Einladung nicht eingeloest:', {
          userId, einladungId, fehler: einloeseFehler.message,
        })
      }
    }

```

- [ ] **Step 2: Typprüfung und Commit**

Run: `npx tsc --noEmit`
Expected: keine Fehler.

```bash
git add src/lib/profil-anlegen.ts
git commit -m "fix: Einladungen fuer Organisationen landen in vereine (einladung_einloesen)"
```

---

### Task 19: Rollenzuweisung der Verwaltung umbauen

**Files:**
- Modify: `src/app/api/verwaltung/nutzer/rolle/route.ts:20-138`

- [ ] **Step 1: Transfer- und Anlagezweige ersetzen**

Import ergänzen: `import { meineMitgliedschaft, rpcFehler } from '@/lib/mitgliedschaft'`.

`const { email, neueRolle, organisation_name, verein_id, org_id } = v.data` ändern zu `const { email, neueRolle, organisation_name } = v.data`.

Alles von `let orgName: string | null = organisation_name ?? null` bis einschließlich des Blocks `// Neue Rolle setzen … if (rolleUpdateError) return apiError(…)` ersetzen durch:

```ts
    const orgName: string | null = organisation_name ?? null
    const vereinsRolle = ['verein', 'organisation', 'gewerbe'].includes(neueRolle)
    const mitgliedschaft = await meineMitgliedschaft(supabase, zielProfil.id)

    if (mitgliedschaft) {
      // Mitglieder wechseln nicht still die Rolle: erst aus dem Verein entfernen.
      if (neueRolle !== 'buerger') {
        return apiError(
          'Diese Person ist Mitglied eines Vereins oder Gewerbes. Bitte entfernen Sie sie zuerst dort (Bereich „Vereine & Gewerbe“).',
          409,
        )
      }
      const { error } = await supabase.rpc('mitglied_entfernen', {
        p_profile_id: zielProfil.id,
        p_ausgefuehrt_von: profile.id,
      })
      if (error) {
        const f = rpcFehler(error)
        return apiError(f.meldung, f.status)
      }
    } else if (vereinsRolle && orgName) {
      // Neuen Verein/Gewerbe anlegen, Person wird Verwalter (protokolliert die Funktion)
      const { error } = await supabase.rpc('verein_anlegen', {
        p_profile_id: zielProfil.id,
        p_typ: neueRolle,
        p_name: orgName,
        p_ausgefuehrt_von: profile.id,
      })
      if (error) {
        const f = rpcFehler(error)
        return apiError(f.meldung, f.status)
      }
    } else {
      const { error: rolleUpdateError } = await supabase
        .from('profiles')
        .update({ role: neueRolle as UserRole })
        .eq('id', zielProfil.id)

      if (rolleUpdateError) return apiError(`Rolle konnte nicht gesetzt werden: ${rolleUpdateError.message}`)

      await supabase.from('rollen_log').insert({
        gemeinde_id: gemeindeId,
        aktion: alteRolle !== 'buerger' ? 'rolle_transfer' : 'rolle_gesetzt',
        ziel_profile_id: zielProfil.id,
        ziel_email: email.toLowerCase(),
        alte_rolle: alteRolle,
        neue_rolle: neueRolle,
        ausgefuehrt_von: profile.id,
      })
    }
```

Danach den alten Block `// Audit-Log für den Ziel-Nutzer … await supabase.from('rollen_log').insert({ … })` (der jetzt im `else`-Zweig steckt) **löschen**. Die Blöcke „Offene Einladungen widerrufen“ und „E-Mail an Ziel-Nutzer“ bleiben unverändert.

- [ ] **Step 2: Typprüfung, Lint, Commit**

Run: `npx tsc --noEmit && npx eslint src/app/api/verwaltung/nutzer/rolle`
Expected: keine Fehler.

```bash
git add src/app/api/verwaltung/nutzer/rolle/route.ts
git commit -m "feat: Rollenzuweisung nutzt Mitgliedschaften statt Eigentumsuebertragung"
```

---

### Task 20: Absender über `posts.org_id`

**Files:**
- Create: `src/lib/absender.ts`
- Create: `src/lib/absender.test.ts`
- Modify: `src/app/(app)/feed/page.tsx:41-82`
- Modify: `src/app/(app)/veranstaltungen/page.tsx`
- Modify: `src/lib/publicPostQuery.ts`, `src/app/posts/[id]/page.tsx:78-81`
- Modify: `src/app/(admin)/dashboard/page.tsx:457`

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest'
import { mitVereinsabsender, vereinsIds } from './absender'

const NAMEN = new Map([['v1', 'TSV']])

describe('mitVereinsabsender', () => {
  it('setzt den Vereinsnamen aus org_id bei Vereinsbeiträgen', () => {
    expect(mitVereinsabsender({ channel: 'verein', org_id: 'v1' }, { display_name: 'Anna', verein_name: 'alt', role: 'verein' }, NAMEN))
      .toEqual({ display_name: 'Anna', verein_name: 'TSV', role: 'verein' })
  })

  it('erzeugt einen Absender, wenn der Autor gelöscht wurde', () => {
    expect(mitVereinsabsender({ channel: 'verein', org_id: 'v1' }, null, NAMEN))
      .toEqual({ display_name: null, verein_name: 'TSV', role: 'verein', avatar_url: null })
  })

  it('lässt andere Kanäle unverändert', () => {
    const autor = { display_name: 'Rat', verein_name: null, role: 'gemeinderat' }
    expect(mitVereinsabsender({ channel: 'gemeinde', org_id: null }, autor, NAMEN)).toBe(autor)
  })
})

describe('vereinsIds', () => {
  it('nur Vereinsbeiträge mit org_id, ohne Dubletten', () => {
    expect(vereinsIds([
      { channel: 'verein', org_id: 'v1' }, { channel: 'verein', org_id: 'v1' },
      { channel: 'gewerbe', org_id: 'g1' }, { channel: 'verein', org_id: null },
    ])).toEqual(['v1'])
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `npx vitest run src/lib/absender.test.ts`
Expected: FAIL — Modul fehlt.

- [ ] **Step 3: Implementierung**

```ts
/**
 * Absender eines Vereinsbeitrags ist der Verein, nicht die Person.
 *
 * Feed, Kalender und Share-Seite zeigen den Vereinsnamen bisher aus
 * profiles.verein_name des Autors. Seit Migration 065 kann ein Verein mehrere
 * Autoren haben und Beiträge überleben gelöschte Konten (author_id = null).
 * Deshalb kommt der Name jetzt über posts.org_id aus vereine.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

interface AbsenderPost {
  channel: string
  org_id: string | null
}

export interface AutorAnzeige {
  display_name?: string | null
  verein_name?: string | null
  role?: string | null
  avatar_url?: string | null
}

export function vereinsIds(posts: AbsenderPost[]): string[] {
  return [...new Set(posts.filter(p => p.channel === 'verein' && p.org_id).map(p => p.org_id!))]
}

export async function ladeVereinsnamen(
  client: SupabaseClient<Database>,
  posts: AbsenderPost[],
): Promise<Map<string, string>> {
  const ids = vereinsIds(posts)
  if (ids.length === 0) return new Map()
  const { data } = await client.from('vereine').select('id, verein_name').in('id', ids)
  return new Map((data ?? []).map(v => [v.id, v.verein_name]))
}

export function mitVereinsabsender<A extends AutorAnzeige>(
  post: AbsenderPost,
  autor: A | null,
  namen: Map<string, string>,
): A | AutorAnzeige | null {
  if (post.channel !== 'verein' || !post.org_id) return autor
  const name = namen.get(post.org_id) ?? null
  if (!autor) return name ? { display_name: null, verein_name: name, role: 'verein', avatar_url: null } : null
  return { ...autor, verein_name: name }
}
```

- [ ] **Step 4: Test laufen lassen**

Run: `npx vitest run src/lib/absender.test.ts`
Expected: PASS

- [ ] **Step 5: Feed**

In `src/app/(app)/feed/page.tsx`:

Import: `import { ladeVereinsnamen, mitVereinsabsender } from '@/lib/absender'`.

Die zweite Abfrage im `Promise.all` (Vereinsnamen aus `profiles`)

```ts
    gemeindeId
      ? supabase.from('profiles')
          .select('verein_name')
          .eq('gemeinde_id', gemeindeId)
          .eq('role', 'verein')
          .not('verein_name', 'is', null)
      : Promise.resolve({ data: [] }),
```

ersetzen durch

```ts
    gemeindeId
      ? supabase.from('vereine')
          .select('verein_name')
          .eq('gemeinde_id', gemeindeId)
          .eq('typ', 'verein')
      : Promise.resolve({ data: [] }),
```

Den Block

```ts
  const postsWithProfiles = posts.map((post) => ({
    ...post,
    profiles: (authorProfiles ?? []).find(p => p.id === post.author_id) ?? null,
  })) as unknown as Parameters<typeof FeedClient>[0]['posts']
```

ersetzen durch

```ts
  const vereinsnamen = await ladeVereinsnamen(supabase, posts)

  const postsWithProfiles = posts.map((post) => ({
    ...post,
    profiles: mitVereinsabsender(post, (authorProfiles ?? []).find(p => p.id === post.author_id) ?? null, vereinsnamen),
  })) as unknown as Parameters<typeof FeedClient>[0]['posts']
```

- [ ] **Step 6: Kalender**

In `src/app/(app)/veranstaltungen/page.tsx` in **beiden** Select-Strings `channel, tag` durch `channel, org_id, tag` ersetzen. Import `import { ladeVereinsnamen, mitVereinsabsender } from '@/lib/absender'`. Die Zeile

```ts
  const veranstaltungen = [...((haupttermine ?? []) as unknown as V[]), ...zusatzAlsVeranstaltung]
    .sort((a, b) => a.veranstaltung_datum.localeCompare(b.veranstaltung_datum))
```

ersetzen durch

```ts
  type MitOrg = V & { channel: string; org_id: string | null }
  const alle = [...((haupttermine ?? []) as unknown as MitOrg[]), ...(zusatzAlsVeranstaltung as MitOrg[])]
  const vereinsnamen = await ladeVereinsnamen(supabase, alle)
  const veranstaltungen = alle
    .map(v => ({ ...v, profiles: mitVereinsabsender(v, v.profiles ?? null, vereinsnamen) }) as V)
    .sort((a, b) => a.veranstaltung_datum.localeCompare(b.veranstaltung_datum))
```

- [ ] **Step 7: Share-Seite**

In `src/lib/publicPostQuery.ts` im Select-String `tag, channel,` durch `tag, channel, org_id,` ersetzen.

In `src/app/posts/[id]/page.tsx` den modulweiten Client typisieren, damit er zu `ladeVereinsnamen` passt: `import type { Database } from '@/types/supabase'` und `createClient(` → `createClient<Database>(`. Meldet `tsc` danach neue Fehler in dieser Datei, die vorhandenen Casts (`post.gemeinden as …`, `post.profiles as …`) beibehalten bzw. ergänzen. Import `import { ladeVereinsnamen, mitVereinsabsender } from '@/lib/absender'` und die Zeilen

```ts
  const autor = post.profiles as { display_name?: string; verein_name?: string } | null
  const autorName = autor?.verein_name ?? autor?.display_name ?? gemeindeName
```

ersetzen durch

```ts
  // anon darf vereine lesen (Migration 060)
  const vereinsnamen = await ladeVereinsnamen(supabase, [post])
  const autor = mitVereinsabsender(post, post.profiles as { display_name?: string | null; verein_name?: string | null } | null, vereinsnamen)
  const autorName = autor?.verein_name ?? autor?.display_name ?? gemeindeName
```

- [ ] **Step 8: Freigabeliste im Verwaltungs-Dashboard**

In `src/app/(admin)/dashboard/page.tsx` in der `pendingPosts`-Abfrage (Zeile ~457) `channel, tag,` durch `channel, org_id, tag,` ersetzen. Import `import { ladeVereinsnamen, mitVereinsabsender } from '@/lib/absender'`. Die Zeile

```ts
  const pendingPosts = pendingPostsResult.data ?? []
```

ersetzen durch

```ts
  const pendingRoh = pendingPostsResult.data ?? []
  const pendingNamen = await ladeVereinsnamen(service, pendingRoh)
  const pendingPosts = pendingRoh.map(p => ({ ...p, profiles: mitVereinsabsender(p, p.profiles, pendingNamen) }))
```

- [ ] **Step 9: Tests, Typen, Commit**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, keine Typfehler.

```bash
git add src/lib/absender.ts src/lib/absender.test.ts src/lib/publicPostQuery.ts "src/app/(app)/feed/page.tsx" "src/app/(app)/veranstaltungen/page.tsx" "src/app/posts/[id]/page.tsx" "src/app/(admin)/dashboard/page.tsx"
git commit -m "feat: Vereinsname als Absender kommt aus posts.org_id"
```

---

### Task 21: Komponente `MitgliederSection`

**Files:**
- Create: `src/components/dashboard/MitgliederSection.tsx`

- [ ] **Step 1: Komponente schreiben**

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, UserPlus } from 'lucide-react'
import type { MitgliedRolle, TeamDaten, ZielTyp } from '@/lib/mitgliedschaft'

interface Props {
  /** Nur für die Verwaltung. Mitglieder lassen das weg — es gilt ihr eigener Verein. */
  ziel?: { verein_id?: string; organisation_id?: string }
  /** Nach jedem Laden, z.B. um Zähler in der Verwaltungsliste zu aktualisieren. */
  onGeladen?: (daten: TeamDaten) => void
  /** Nach dem Löschen des Vereins. Ohne Angabe: Weiterleitung in den Feed. */
  onGeloescht?: () => void
}

const ROLLEN_LABEL: Record<MitgliedRolle, string> = { verwalter: 'Verwalter', autor: 'Autor' }
const TYP_LABEL: Record<ZielTyp, string> = { verein: 'Verein', organisation: 'Organisation', gewerbe: 'Betrieb' }

const hinzufuegenSchema = z.object({
  email: z.email('Bitte eine gültige E-Mail-Adresse eingeben.'),
  rolle: z.enum(['verwalter', 'autor']),
})
type HinzufuegenWerte = z.infer<typeof hinzufuegenSchema>

const loeschenSchema = z.object({ bestaetigung: z.string() })
type LoeschenWerte = z.infer<typeof loeschenSchema>

async function senden(method: string, url: string, body: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? 'Die Aktion ist fehlgeschlagen.')
  return json
}

export default function MitgliederSection({ ziel, onGeladen, onGeloescht }: Props) {
  const query = new URLSearchParams(
    Object.entries(ziel ?? {}).filter((e): e is [string, string] => !!e[1]),
  ).toString()

  const [daten, setDaten] = useState<TeamDaten | null>(null)
  const [ladeFehler, setLadeFehler] = useState<string | null>(null)
  const [bestaetigeEntfernen, setBestaetigeEntfernen] = useState<string | null>(null)
  const [beschaeftigt, setBeschaeftigt] = useState(false)

  const laden = useCallback(async () => {
    try {
      const res = await fetch(`/api/mitglieder${query ? `?${query}` : ''}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Das Team konnte nicht geladen werden.')
      setDaten(json as TeamDaten)
      setLadeFehler(null)
      onGeladen?.(json as TeamDaten)
    } catch (e) {
      setLadeFehler(e instanceof Error ? e.message : 'Das Team konnte nicht geladen werden.')
    }
  }, [query, onGeladen])

  useEffect(() => { void laden() }, [laden])

  const form = useForm<HinzufuegenWerte>({
    resolver: zodResolver(hinzufuegenSchema),
    defaultValues: { email: '', rolle: 'autor' },
  })
  const loeschForm = useForm<LoeschenWerte>({ resolver: zodResolver(loeschenSchema), defaultValues: { bestaetigung: '' } })
  const eingetippt = loeschForm.watch('bestaetigung')

  async function aktion(fn: () => Promise<unknown>, erfolg: string) {
    setBeschaeftigt(true)
    try {
      await fn()
      toast.success(erfolg)
      await laden()
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Die Aktion ist fehlgeschlagen.')
      return false
    } finally {
      setBeschaeftigt(false)
      setBestaetigeEntfernen(null)
    }
  }

  if (ladeFehler) return <p role="alert" className="text-sm text-red-700">{ladeFehler}</p>
  if (!daten) {
    return (
      <p className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" /> Team wird geladen …
      </p>
    )
  }

  const darfVerwalten = daten.recht !== 'autor'
  const istVerwaltung = daten.recht === 'verwaltung'
  const verwalterAnzahl = daten.mitglieder.filter(m => m.rolle === 'verwalter').length
  const ich = daten.mitglieder.find(m => m.ich)
  const ichLetzterVerwalter = ich?.rolle === 'verwalter' && verwalterAnzahl === 1
  const zielBody = { verein_id: ziel?.verein_id, organisation_id: ziel?.organisation_id }
  const idPrefix = `team-${daten.ziel.verein_id ?? daten.ziel.organisation_id}`

  const hinzufuegen = form.handleSubmit(async werte => {
    setBeschaeftigt(true)
    try {
      const res = await senden('POST', '/api/mitglieder', { ...zielBody, ...werte })
      toast.success(res.art === 'eingeladen'
        ? `Einladung an ${werte.email} verschickt.`
        : `${werte.email} wurde hinzugefügt.`)
      form.reset({ email: '', rolle: werte.rolle })
      await laden()
    } catch (e) {
      form.setError('email', { message: e instanceof Error ? e.message : 'Hinzufügen fehlgeschlagen.' })
    } finally {
      setBeschaeftigt(false)
    }
  })

  const loeschen = loeschForm.handleSubmit(async werte => {
    setBeschaeftigt(true)
    try {
      await senden('DELETE', '/api/mitglieder/verein', { ...zielBody, bestaetigung: werte.bestaetigung })
      toast.success(`„${daten.ziel.name}“ wurde gelöscht.`)
      if (onGeloescht) onGeloescht()
      else window.location.href = '/feed'
    } catch (e) {
      loeschForm.setError('bestaetigung', { message: e instanceof Error ? e.message : 'Löschen fehlgeschlagen.' })
    } finally {
      setBeschaeftigt(false)
    }
  })

  return (
    <div className="space-y-6">
      {/* Mitglieder */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-2">Mitglieder</h3>
        {daten.mitglieder.length === 0 && (
          <p className="text-sm text-gray-600">Noch keine Mitglieder. Fügen Sie unten eine Person als Verwalter hinzu.</p>
        )}
        <ul className="divide-y divide-gray-100">
          {daten.mitglieder.map(m => (
            <li key={m.profile_id} className="py-3 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{m.name}{m.ich && ' (Sie)'}</p>
                {m.email && <p className="text-xs text-gray-600 truncate">{m.email}</p>}
              </div>

              {darfVerwalten ? (
                <>
                  <label htmlFor={`${idPrefix}-rolle-${m.profile_id}`} className="sr-only">Rolle von {m.name}</label>
                  <select
                    id={`${idPrefix}-rolle-${m.profile_id}`}
                    value={m.rolle}
                    disabled={beschaeftigt}
                    onChange={e => aktion(
                      () => senden('PATCH', '/api/mitglieder', { profile_id: m.profile_id, rolle: e.target.value }),
                      'Rolle geändert.',
                    )}
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1.5"
                  >
                    <option value="verwalter">Verwalter</option>
                    <option value="autor">Autor</option>
                  </select>
                </>
              ) : (
                <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded-full">{ROLLEN_LABEL[m.rolle]}</span>
              )}

              {darfVerwalten && !m.ich && (
                bestaetigeEntfernen === m.profile_id ? (
                  <span className="flex items-center gap-2 text-sm">
                    <span className="text-gray-700">Wirklich entfernen?</span>
                    <button type="button" disabled={beschaeftigt}
                      onClick={() => aktion(() => senden('DELETE', '/api/mitglieder', { profile_id: m.profile_id }), `${m.name} wurde entfernt.`)}
                      className="font-bold text-red-700">Ja</button>
                    <button type="button" onClick={() => setBestaetigeEntfernen(null)} className="text-gray-700">Abbrechen</button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setBestaetigeEntfernen(m.profile_id)}
                    className="text-sm font-medium text-red-700">Entfernen</button>
                )
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Offene Einladungen */}
      {daten.einladungen.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-900 mb-2">Offene Einladungen</h3>
          <ul className="divide-y divide-gray-100">
            {daten.einladungen.map(e => (
              <li key={e.id} className="py-2 flex items-center gap-3 text-sm">
                <span className="flex-1 min-w-0 truncate text-gray-900">{e.email}</span>
                <span className="text-xs text-gray-600">{ROLLEN_LABEL[e.mitglied_rolle]}</span>
                {darfVerwalten && (
                  <button type="button" disabled={beschaeftigt}
                    onClick={() => aktion(() => senden('DELETE', '/api/mitglieder/einladung', { ...zielBody, einladung_id: e.id }), 'Einladung zurückgezogen.')}
                    className="font-medium text-red-700">Zurückziehen</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Hinzufügen */}
      {darfVerwalten && (
        <form onSubmit={hinzufuegen} noValidate className="space-y-3">
          <h3 className="text-sm font-bold text-gray-900">Person hinzufügen</h3>
          <p className="text-xs text-gray-600">
            Hat die Person schon ein Konto in Ihrer Gemeinde, wird sie sofort hinzugefügt. Sonst bekommt sie eine Einladung per E-Mail.
            Eine Person kann nur einem Verein oder Betrieb angehören.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <label htmlFor={`${idPrefix}-email`} className="block text-xs font-medium text-gray-700 mb-1">E-Mail-Adresse</label>
              <input id={`${idPrefix}-email`} type="email" autoComplete="off" {...form.register('email')}
                aria-invalid={!!form.formState.errors.email}
                aria-describedby={form.formState.errors.email ? `${idPrefix}-email-fehler` : undefined}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label htmlFor={`${idPrefix}-neu-rolle`} className="block text-xs font-medium text-gray-700 mb-1">Rolle</label>
              <select id={`${idPrefix}-neu-rolle`} {...form.register('rolle')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="autor">Autor (schreibt Beiträge)</option>
                <option value="verwalter">Verwalter (auch Profil und Team)</option>
              </select>
            </div>
            <div className="sm:self-end">
              <button type="submit" disabled={beschaeftigt}
                className="w-full flex items-center justify-center gap-2 bg-primary-500 text-white font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                <UserPlus aria-hidden="true" className="w-4 h-4" /> Hinzufügen
              </button>
            </div>
          </div>
          {form.formState.errors.email && (
            <p id={`${idPrefix}-email-fehler`} role="alert" className="text-sm text-red-700">{form.formState.errors.email.message}</p>
          )}
        </form>
      )}

      {/* Verlassen */}
      {ich && (
        <div>
          <button type="button" disabled={beschaeftigt || ichLetzterVerwalter}
            aria-describedby={ichLetzterVerwalter ? `${idPrefix}-verlassen-hinweis` : undefined}
            onClick={async () => {
              if (await aktion(() => senden('DELETE', '/api/mitglieder', { profile_id: ich.profile_id }), 'Sie haben das Team verlassen.')) {
                window.location.href = '/feed'
              }
            }}
            className="text-sm font-medium text-red-700 disabled:text-gray-500">
            {TYP_LABEL[daten.ziel.typ]} verlassen
          </button>
          {ichLetzterVerwalter && (
            <p id={`${idPrefix}-verlassen-hinweis`} className="text-xs text-gray-600 mt-1">
              Lege zuerst eine andere Person als Verwalter fest.
            </p>
          )}
        </div>
      )}

      {/* Gefahrenbereich */}
      {darfVerwalten && (
        <form onSubmit={loeschen} noValidate className="border border-red-200 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-red-700">{TYP_LABEL[daten.ziel.typ]} löschen</h3>
          <p className="text-sm text-gray-700">
            Gelöscht werden endgültig: {daten.umfang.beitraege} Beiträge, {daten.umfang.abonnenten} Abonnements
            und das Profil. {daten.mitglieder.length} {daten.mitglieder.length === 1 ? 'Mitglied verliert' : 'Mitglieder verlieren'} den Zugang
            {istVerwaltung ? '' : ', auch Sie'}.
          </p>
          <div>
            <label htmlFor={`${idPrefix}-bestaetigung`} className="block text-xs font-medium text-gray-700 mb-1">
              Zum Bestätigen „{daten.ziel.name}“ eintippen
            </label>
            <input id={`${idPrefix}-bestaetigung`} type="text" autoComplete="off" {...loeschForm.register('bestaetigung')}
              aria-invalid={!!loeschForm.formState.errors.bestaetigung}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          {loeschForm.formState.errors.bestaetigung && (
            <p role="alert" className="text-sm text-red-700">{loeschForm.formState.errors.bestaetigung.message}</p>
          )}
          <button type="submit" disabled={beschaeftigt || eingetippt.trim() !== daten.ziel.name.trim()}
            className="bg-red-600 text-white font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-40">
            Endgültig löschen
          </button>
        </form>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Lint und Typen**

Run: `npx tsc --noEmit && npx eslint src/components/dashboard/MitgliederSection.tsx`
Expected: keine Fehler. Meldet `react-hooks/set-state-in-effect` den `useEffect`, die Zeile lassen — `laden` setzt den State erst nach `await`. Falls die Regel trotzdem anschlägt: `useEffect(() => { const t = setTimeout(() => void laden(), 0); return () => clearTimeout(t) }, [laden])`.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/MitgliederSection.tsx
git commit -m "feat: Bereich Team mit Mitgliedern, Einladungen und Loeschen"
```

---

### Task 22: Vereins-Dashboard

**Files:**
- Modify: `src/app/(admin)/dashboard/page.tsx:375-425`
- Modify: `src/components/dashboard/VereinPostVerwaltung.tsx`

- [ ] **Step 1: Daten über die Mitgliedschaft laden**

In `src/app/(admin)/dashboard/page.tsx` Import `import { meinVereinsziel, kurzname } from '@/lib/mitgliedschaft'`. Den Block ab `if (profile.role === 'verein' || profile.role === 'organisation') {` bis vor `const VereinPostVerwaltung = …` ersetzen durch:

```ts
  if (profile.role === 'verein' || profile.role === 'organisation') {
    const vereinService = await createServiceClient()
    const mitgliedschaft = await meinVereinsziel(vereinService, user!.id, 'verein')

    const [vereinPostsResult, vereinProfilResult, kategorienResult] = await Promise.all([
      mitgliedschaft
        ? vereinService
            .from('posts')
            .select('id, titel, inhalt, status, created_at, tag, bild_url, publish_at, rejection_reason, veranstaltung_datum, veranstaltung_ort, author_id, post_termine(datum)')
            .eq('org_id', mitgliedschaft.id)
            .eq('channel', 'verein')
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      mitgliedschaft
        ? vereinService.from('vereine').select('*').eq('id', mitgliedschaft.id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('verein_kategorien')
        .select('id, name, reihenfolge')
        .order('reihenfolge'),
    ])

    const vereinProfil = vereinProfilResult.data ?? null

    // „von Vorname N.“ an jedem Beitrag
    const rohPosts = (vereinPostsResult.data ?? []) as { author_id: string | null }[]
    const autorIds = [...new Set(rohPosts.map(p => p.author_id).filter((id): id is string => !!id))]
    const { data: autoren } = autorIds.length
      ? await vereinService.from('profiles').select('id, vorname, nachname, display_name').in('id', autorIds)
      : { data: [] }
    const vereinPosts = rohPosts.map(p => ({
      ...p,
      autor_name: kurzname((autoren ?? []).find(a => a.id === p.author_id) ?? null),
    }))

    // Abonnenten-Stats nur wenn Profil vorhanden
    let abonnentenStats = null
    if (vereinProfil) {
      const jetzt = new Date()
```

Den bisherigen Abschnitt `const vereinService = await createServiceClient()` innerhalb von `if (vereinProfil) {` löschen (jetzt oben). Die Props an `VereinPostVerwaltung` ändern:

```tsx
      <VereinPostVerwaltung
        posts={vereinPosts as unknown as Parameters<typeof VereinPostVerwaltung>[0]['posts']}
        gemeindeId={profile.gemeinde_id!}
        profileId={user!.id}
        vereinName={vereinProfil?.verein_name ?? null}
        role={profile.role as 'verein' | 'organisation'}
        mitgliedRolle={mitgliedschaft?.rolle ?? null}
        vereinProfil={vereinProfil}
        kategorien={kategorienResult.data ?? []}
        abonnentenStats={abonnentenStats}
      />
```

- [ ] **Step 2: `VereinPostVerwaltung` erweitern**

In `src/components/dashboard/VereinPostVerwaltung.tsx`:

1. Import: `import MitgliederSection from './MitgliederSection'`.
2. Im `interface Post` ergänzen: `autor_name?: string | null`.
3. In `interface Props` ergänzen: `mitgliedRolle?: 'verwalter' | 'autor' | null`.
4. Im Destructuring der Props `mitgliedRolle = null` ergänzen.
5. Unter `const accentColor = …` einfügen:
   ```ts
   const istVerwalter = mitgliedRolle === 'verwalter'
   ```
6. Den Header-Button „Profil“ nur für Verwalter zeigen: `{vereinProfil && (` → `{vereinProfil && istVerwalter && (`.
7. Den Block `{vereinProfil && showProfilForm && (` → `{vereinProfil && istVerwalter && showProfilForm && (`. Dem Schließen-Button darin `aria-label="Profil bearbeiten schließen"` geben und dem `X`-Icon `aria-hidden="true"`.
8. In der Beitragsliste nach dem `<p className="text-xs text-gray-400">…{new Date(post.created_at)…}</p>` einfügen:
   ```tsx
   <p className="text-xs text-gray-600">von {post.autor_name ?? 'ehemaligem Mitglied'}</p>
   ```
   und im Datums-`<p>` direkt davor `text-gray-400` durch `text-gray-600` ersetzen (Kontrast auf Weiß, siehe CLAUDE.md).
9. Nach dem schließenden `</div>` der Beitragsliste (`{/* Beiträge Liste */}`-Block), noch innerhalb von `<div className="px-8 py-6">`, einfügen:
   ```tsx
   {vereinProfil && (
     <section aria-labelledby="team-titel" className="bg-white rounded-2xl shadow-sm p-6 mt-6">
       <h2 id="team-titel" className="font-bold text-gray-900 mb-4">Team</h2>
       <MitgliederSection />
     </section>
   )}
   ```

- [ ] **Step 3: Typen, Lint, Commit**

Run: `npx tsc --noEmit && npx eslint "src/app/(admin)/dashboard/page.tsx" src/components/dashboard/VereinPostVerwaltung.tsx`
Expected: keine Fehler.

```bash
git add "src/app/(admin)/dashboard/page.tsx" src/components/dashboard/VereinPostVerwaltung.tsx
git commit -m "feat: Vereins-Dashboard zeigt alle Vereinsbeitraege und das Team"
```

---

### Task 23: Gewerbe-Dashboard

**Files:**
- Modify: `src/app/(app)/gewerbe/dashboard/page.tsx`
- Modify: `src/app/(app)/gewerbe/dashboard/GewerbeDashboardClient.tsx`

- [ ] **Step 1: Seite auf Mitgliedschaft umstellen**

In `page.tsx`: Imports `import { createClient, createServiceClient } from '@/lib/supabase/server'` und `import { meinVereinsziel, kurzname } from '@/lib/mitgliedschaft'`.

Den Block `// Betrieb laden (falls vorhanden)` … `.single()` ersetzen durch:

```ts
  const service = await createServiceClient()
  const mitgliedschaft = await meinVereinsziel(service, user.id, 'gewerbe')

  const { data: betrieb } = mitgliedschaft
    ? await service.from('organisationen').select('*').eq('id', mitgliedschaft.id).eq('typ', 'gewerbe').single()
    : { data: null }
  const mitgliedRolle = mitgliedschaft?.rolle ?? null
```

Im `if (!betrieb)`-Return `mitgliedRolle={null} autorNamen={{}}` ergänzen.

Bei `postsThisWeek` `.eq('author_id', user.id)` → `.eq('org_id', betrieb.id)`, und `supabase` → `service`. Ebenso bei „Letzte Posts“: `.eq('author_id', user.id)` → `.eq('org_id', betrieb.id)`, `supabase` → `service`.

Nach „Letzte Posts“ einfügen:

```ts
  const autorIds = [...new Set((posts ?? []).map(p => p.author_id).filter((id): id is string => !!id))]
  const { data: autoren } = autorIds.length
    ? await service.from('profiles').select('id, vorname, nachname, display_name').in('id', autorIds)
    : { data: [] }
  const autorNamen = Object.fromEntries((autoren ?? []).map(a => [a.id, kurzname(a) ?? '']))
```

Im finalen Return `mitgliedRolle={mitgliedRolle}` und `autorNamen={autorNamen}` ergänzen.

- [ ] **Step 2: Client erweitern**

In `GewerbeDashboardClient.tsx`:

1. Import `import MitgliederSection from '@/components/dashboard/MitgliederSection'` und `UserCog` zu den lucide-Imports.
2. `interface Props` ergänzen: `mitgliedRolle: 'verwalter' | 'autor' | null` und `autorNamen: Record<string, string>`; im Destructuring übernehmen.
3. `useState<'posts' | 'profil'>` → `useState<'posts' | 'profil' | 'team'>`.
4. Tab-Leiste ersetzen durch eine zugängliche Tab-Navigation (CLAUDE.md):
   ```tsx
   <div role="tablist" aria-label="Bereiche" className="flex gap-2">
     <TabButton id="tab-posts" panel="panel-posts" active={tab === 'posts'} icon={<PenLine aria-hidden="true" className="w-3.5 h-3.5" />} onClick={() => setTab('posts')}>
       Beiträge
     </TabButton>
     {mitgliedRolle === 'verwalter' && (
       <TabButton id="tab-profil" panel="panel-profil" active={tab === 'profil'} icon={<Building2 aria-hidden="true" className="w-3.5 h-3.5" />} onClick={() => setTab('profil')}>
         Profil
       </TabButton>
     )}
     <TabButton id="tab-team" panel="panel-team" active={tab === 'team'} icon={<UserCog aria-hidden="true" className="w-3.5 h-3.5" />} onClick={() => setTab('team')}>
       Team
     </TabButton>
   </div>
   ```
5. Die drei Panels in `role="tabpanel"` hüllen: `{tab === 'posts' && (<div role="tabpanel" id="panel-posts" aria-labelledby="tab-posts" className="space-y-4">…` (das bestehende `<div className="space-y-4">` wird dazu), `{tab === 'profil' && mitgliedRolle === 'verwalter' && (<div role="tabpanel" id="panel-profil" aria-labelledby="tab-profil"><Card>…</Card></div>)}` und neu:
   ```tsx
   {tab === 'team' && (
     <div role="tabpanel" id="panel-team" aria-labelledby="tab-team">
       <Card><MitgliederSection /></Card>
     </div>
   )}
   ```
   Den Akkordeon-Button „Profil bearbeiten“ im Profil-Panel mit `aria-expanded={profilOpen}` versehen, Chevron-Icons mit `aria-hidden="true"`.
6. `TabButton` ersetzen:
   ```tsx
   function TabButton({ id, panel, active, icon, onClick, children }: {
     id: string
     panel: string
     active: boolean
     icon: React.ReactNode
     onClick: () => void
     children: React.ReactNode
   }) {
     return (
       <button
         type="button"
         role="tab"
         id={id}
         aria-selected={active}
         aria-controls={panel}
         onClick={onClick}
         className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition-colors ${
           active ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 shadow-[0_2px_8px_rgba(15,45,107,0.08)]'
         }`}
       >
         {icon}
         {children}
       </button>
     )
   }
   ```
7. In der Beitragsliste das `<p className="text-xs text-gray-400 mt-2">` mit `formatDistanceToNow(…)` ersetzen durch:
   ```tsx
   <p className="text-xs text-gray-600 mt-2">
     {post.published_at ? formatDistanceToNow(new Date(post.published_at), { addSuffix: true, locale: de }) : ''}
     {' · von '}{(post.author_id && autorNamen[post.author_id]) || 'ehemaligem Mitglied'}
   </p>
   ```

- [ ] **Step 3: Typen, Lint, Commit**

Run: `npx tsc --noEmit && npx eslint "src/app/(app)/gewerbe/dashboard"`
Expected: keine Fehler.

```bash
git add "src/app/(app)/gewerbe/dashboard"
git commit -m "feat: Gewerbe-Dashboard mit Team-Tab und Beitraegen aller Mitglieder"
```

---

### Task 24: Verwaltung — Bereich „Vereine & Gewerbe“

**Files:**
- Create: `src/components/dashboard/VereineVerwaltungSection.tsx`
- Modify: `src/app/(admin)/dashboard/page.tsx`

- [ ] **Step 1: Komponente**

```tsx
'use client'

import { useCallback, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'
import MitgliederSection from './MitgliederSection'
import type { TeamDaten, VereinsEintrag, ZielTyp } from '@/lib/mitgliedschaft'

const TYP_LABEL: Record<ZielTyp, string> = { verein: 'Verein', organisation: 'Organisation', gewerbe: 'Gewerbe' }

export default function VereineVerwaltungSection({ eintraege: start }: { eintraege: VereinsEintrag[] }) {
  const [eintraege, setEintraege] = useState(start)
  const [offen, setOffen] = useState<string | null>(null)

  // Zähler aktualisieren, wenn im aufgeklappten Eintrag Mitglieder geändert werden
  const aktualisiere = useCallback((d: TeamDaten) => {
    const id = d.ziel.verein_id ?? d.ziel.organisation_id
    setEintraege(liste => liste.map(e => e.id === id
      ? { ...e, mitglieder: d.mitglieder.length, verwalter: d.mitglieder.filter(m => m.rolle === 'verwalter').length }
      : e))
  }, [])

  // Ohne Verwalter zuerst, sonst alphabetisch
  const sortiert = [...eintraege].sort((a, b) =>
    Number(a.verwalter > 0) - Number(b.verwalter > 0) || a.name.localeCompare(b.name, 'de'))

  return (
    <section aria-labelledby="vereine-verwaltung-titel" className="bg-white rounded-2xl shadow-sm p-6">
      <h2 id="vereine-verwaltung-titel" className="font-bold text-gray-900 mb-1">Vereine & Gewerbe</h2>
      <p className="text-sm text-gray-600 mb-4">
        Mitglieder hinzufügen oder entfernen, Verantwortliche wechseln, Einträge löschen.
      </p>

      {sortiert.length === 0 && <p className="text-sm text-gray-600">Noch keine Vereine oder Gewerbe angelegt.</p>}

      <ul className="divide-y divide-gray-100">
        {sortiert.map(e => {
          const aufgeklappt = offen === e.id
          const panelId = `verein-panel-${e.id}`
          return (
            <li key={e.id}>
              <button
                type="button"
                aria-expanded={aufgeklappt}
                aria-controls={panelId}
                onClick={() => setOffen(aufgeklappt ? null : e.id)}
                className="w-full flex items-center gap-3 py-3 text-left"
              >
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-gray-900 truncate">{e.name}</span>
                  <span className="block text-xs text-gray-600">
                    {TYP_LABEL[e.typ]} · {e.mitglieder} {e.mitglieder === 1 ? 'Mitglied' : 'Mitglieder'}
                  </span>
                </span>
                {e.verwalter === 0 && (
                  <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full">Kein Verwalter</span>
                )}
                <ChevronDown aria-hidden="true" className={clsx('w-4 h-4 text-gray-500 transition-transform', aufgeklappt && 'rotate-180')} />
              </button>
              {aufgeklappt && (
                <div id={panelId} className="pb-6">
                  <MitgliederSection
                    ziel={e.typ === 'gewerbe' ? { organisation_id: e.id } : { verein_id: e.id }}
                    onGeladen={aktualisiere}
                    onGeloescht={() => {
                      setEintraege(liste => liste.filter(x => x.id !== e.id))
                      setOffen(null)
                    }}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
```

- [ ] **Step 2: In das Verwaltungs-Dashboard einbinden**

In `src/app/(admin)/dashboard/page.tsx`:

Imports: `import VereineVerwaltungSection from '@/components/dashboard/VereineVerwaltungSection'` und `vereinsEintraege` zum Import aus `@/lib/mitgliedschaft` hinzufügen.

Nach der in Task 20 eingefügten Zeile `const pendingPosts = …` einfügen:

```ts
  const [vereineListe, gewerbeListe, mitgliedschaftenListe] = await Promise.all([
    service.from('vereine').select('id, verein_name, typ').eq('gemeinde_id', gemeindeId!),
    service.from('organisationen').select('id, name').eq('gemeinde_id', gemeindeId!).eq('typ', 'gewerbe'),
    service.from('mitgliedschaften').select('verein_id, organisation_id, rolle'),
  ])
  const vereinsListe = vereinsEintraege(vereineListe.data ?? [], gewerbeListe.data ?? [], mitgliedschaftenListe.data ?? [])
```

Vor `{/* Nutzer & Rollen */}` einfügen:

```tsx
        {/* Vereine & Gewerbe */}
        <VereineVerwaltungSection eintraege={vereinsListe} />
```

- [ ] **Step 3: Typen, Lint, Commit**

Run: `npx tsc --noEmit && npx eslint src/components/dashboard/VereineVerwaltungSection.tsx "src/app/(admin)/dashboard/page.tsx"`
Expected: keine Fehler.

```bash
git add src/components/dashboard/VereineVerwaltungSection.tsx "src/app/(admin)/dashboard/page.tsx"
git commit -m "feat: Verwaltung sieht Vereine und Gewerbe mit Mitgliedern"
```

---

### Task 25: Texte zur Kontolöschung

**Files:**
- Modify: `src/app/konto-loeschen/page.tsx:133-145`
- Modify: `src/app/datenschutz/page.tsx:343-350`

- [ ] **Step 1: `/konto-loeschen`**

Den Absatz

```tsx
          <P>
            Haben Sie ein Konto für einen Verein, ein Gewerbe oder die Verwaltung? Dann löschen wir
            zusätzlich Ihre Beiträge, Ihre Umfragen und Ihr Vereins- oder Gewerbeprofil, jeweils mit
            allen Bildern.
          </P>
```

ersetzen durch

```tsx
          <P>
            Haben Sie ein Konto für die Verwaltung? Dann löschen wir zusätzlich Ihre Beiträge und Ihre
            Umfragen mit allen Bildern.
          </P>
          <P>
            Sind Sie Mitglied eines Vereins, einer Organisation oder eines Gewerbebetriebs? Dann endet
            Ihre Mitgliedschaft. Der Verein bzw. Betrieb und seine Beiträge gehören nicht Ihnen
            persönlich und bleiben bestehen — ohne Bezug zu Ihrer Person. Wollen Sie den ganzen Verein
            löschen, tun Sie das vorher im Dashboard unter „Team“.
          </P>
```

In der Liste „Was bleibt“ (Abschnitt `id="was-bleibt"`) als zweiten Punkt ergänzen:

```tsx
            'Beiträge, die Sie für einen Verein, eine Organisation oder einen Betrieb geschrieben haben. Sie erscheinen ohne Ihren Namen.',
```

- [ ] **Step 2: Datenschutzerklärung (Ziffer 7)**

Den Satz

```
            OneSignal. Bei Konten von Vereinen, Gewerbebetrieben und der Verwaltung werden zusätzlich
            Beiträge, Umfragen und das Vereins- oder Gewerbeprofil mit allen Bildern gelöscht.
```

ersetzen durch

```
            OneSignal. Bei Konten der Verwaltung werden zusätzlich Beiträge und Umfragen mit allen
            Bildern gelöscht. Bei Mitgliedern von Vereinen, Organisationen und Gewerbebetrieben endet
            die Mitgliedschaft; der Verein bzw. Betrieb und seine Beiträge bleiben ohne Bezug zur
            Person erhalten, da sie dem Verein bzw. Betrieb zugeordnet sind.
```

- [ ] **Step 3: Commit**

```bash
git add src/app/konto-loeschen/page.tsx src/app/datenschutz/page.tsx
git commit -m "docs: Kontoloeschung beschreibt Verhalten bei Vereinsmitgliedern"
```

---

### Task 26: Migration 066 — Abschluss nach dem Deploy

**Files:**
- Create: `supabase/migrations/066_mitgliedschaften_abschluss.sql`
- Modify: `src/lib/mitgliedschaften.db.test.ts`

- [ ] **Step 1: Failing test anhängen**

```ts
describe('066 — Abschluss', () => {
  const M066 = migration('066_mitgliedschaften_abschluss.sql')

  it('übernimmt Nachzügler, aber keine bewusst entfernten Personen', async () => {
    let altVerein = ''
    let neuVerein = ''
    await neueDb(async () => {
      await nutzer(ANNA, 'anna@example.de', 'verein')
      altVerein = (await db.query<{ id: string }>(
        `insert into public.vereine (profile_id, gemeinde_id) values ($1, $2) returning id`, [ANNA, G1])).rows[0].id
    })
    // Anna wurde von der Verwaltung entfernt (Rolle buerger, profile_id bleibt stehen)
    await db.query('select public.mitglied_entfernen($1, $2)', [ANNA, VERWALTUNG])
    // Alter Code hat zwischen 065 und Deploy einen Verein angelegt
    await nutzer(BERT, 'bert@example.de', 'verein')
    neuVerein = (await db.query<{ id: string }>(
      `insert into public.vereine (profile_id, gemeinde_id) values ($1, $2) returning id`, [BERT, G1])).rows[0].id

    await db.exec(M066)

    expect(await wert<string>('select verein_id from public.mitgliedschaften where profile_id = $1', [BERT])).toBe(neuVerein)
    expect(await wert<number>('select count(*)::int from public.mitgliedschaften where verein_id = $1', [altVerein])).toBe(0)
  })

  it('entzieht authenticated die Schreibrechte auf vereine und organisationen', async () => {
    await neueDb()
    await db.exec(M066)
    for (const t of ['vereine', 'organisationen']) {
      for (const recht of ['insert', 'update', 'delete']) {
        expect(await wert<boolean>(`has_table_privilege('authenticated', 'public.${t}', '${recht}')`)).toBe(false)
      }
    }
  })
})
```

Damit der zweite Test aussagekräftig ist, in `src/lib/testing/pgliteSchema.ts` am Ende von `BASIS_SCHEMA` ergänzen (spiegelt 012):

```sql
  grant select, insert, update, delete on public.vereine to authenticated;
  grant select, insert, update, delete on public.organisationen to authenticated;
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `npx vitest run src/lib/mitgliedschaften.db.test.ts`
Expected: FAIL — `ENOENT … 066_mitgliedschaften_abschluss.sql`

- [ ] **Step 3: Migration schreiben**

```sql
-- 066: Abschluss der Mitgliedschaften (065). NACH dem Code-Deploy einspielen.
--
-- 1. Nachzügler: Vereine/Gewerbe, die alter Code zwischen 065 und Deploy angelegt
--    hat, haben profile_id, aber keine Mitglieder. Übernommen wird nur, wer noch die
--    passende Rolle hat — bewusst entfernte Personen sind wieder 'buerger'.
-- 2. Alle Schreibwege laufen jetzt über API-Routen mit service_role. Direkte
--    Schreibrechte für authenticated entfallen (vorher per RLS auf profile_id).

insert into public.mitgliedschaften (profile_id, verein_id, rolle)
select v.profile_id, v.id, 'verwalter'
  from public.vereine v
  join public.profiles p on p.id = v.profile_id
 where p.role::text = v.typ
   and not exists (select 1 from public.mitgliedschaften m where m.verein_id = v.id)
on conflict (profile_id) do nothing;

insert into public.mitgliedschaften (profile_id, organisation_id, rolle)
select o.profile_id, o.id, 'verwalter'
  from public.organisationen o
  join public.profiles p on p.id = o.profile_id
 where p.role::text = 'gewerbe'
   and not exists (select 1 from public.mitgliedschaften m where m.organisation_id = o.id)
on conflict (profile_id) do nothing;

drop policy if exists "vereine_insert_own" on public.vereine;
drop policy if exists "vereine_update_own" on public.vereine;
drop policy if exists "vereine_delete_own" on public.vereine;
drop policy if exists "Gewerbe anlegen" on public.organisationen;
drop policy if exists "Gewerbe bearbeiten" on public.organisationen;

revoke insert, update, delete on public.vereine from authenticated;
revoke insert, update, delete on public.organisationen from authenticated;
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run src/lib/mitgliedschaften.db.test.ts src/lib/kontoLoeschen.db.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/066_mitgliedschaften_abschluss.sql src/lib/mitgliedschaften.db.test.ts src/lib/testing/pgliteSchema.ts
git commit -m "feat: Migration 066 schliesst Umstellung auf Mitgliedschaften ab"
```

---

### Task 27: Gesamtprüfung

**Files:** keine

- [ ] **Step 1: Alles prüfen**

Run: `npm run test && npx tsc --noEmit && npm run lint && npm run build`
Expected: alle Tests PASS, keine Typ- oder Lintfehler, Build erfolgreich.

- [ ] **Step 2: Restverweise auf das alte Eigentümermodell suchen**

Run: `git grep -n "profile_id', profile.id\|profile_id', user\|eq('author_id', profile.id)" -- src/app/api/verein src/app/api/gewerbe "src/app/(app)/gewerbe" "src/app/(admin)/dashboard"`
Expected: keine Treffer.

- [ ] **Step 3: Manuell im Browser (`npm run dev`, Gemeinde-Subdomain)**

1. Als Verwalterin eines Vereins: „Team“ → Bürger-Adresse als Autor hinzufügen → erscheint in der Liste; Rolle auf Verwalter ändern; sich selbst entfernen geht erst danach.
2. Als Autor: Beitrag eines anderen Mitglieds bearbeiten → geht; Profil-Button fehlt; Gefahrenbereich fehlt.
3. Unbekannte Adresse hinzufügen → „Einladung verschickt“, steht unter „Offene Einladungen“, Zurückziehen funktioniert.
4. Gemeinderats-Adresse hinzufügen → Meldung „bereits einem Verein zugeordnet oder hat eine andere Rolle“ mit `role="alert"`.
5. Als Verwaltung: „Vereine & Gewerbe“ → Eintrag aufklappen, letzten Verwalter entfernen → Hinweis „Kein Verwalter“, Eintrag rutscht nach oben.
6. Verein löschen mit falschem Namen → Button bleibt deaktiviert; mit richtigem Namen → Weiterleitung, Verein weg aus `/vereine`.
7. Feed und `/veranstaltungen`: Vereinsbeiträge zeigen den Vereinsnamen.
8. Tastatur: Tab durch Team-Bereich, Akkordeon mit Enter, Gewerbe-Tabs mit `aria-selected`.

- [ ] **Step 4: Ausrollen**

1. Deploy des Codes (065 ist bereits eingespielt, Task 8).
2. Mensch spielt `066_mitgliedschaften_abschluss.sql` im SQL-Editor ein.
3. Prüfen: `select count(*) from public.vereine v where not exists (select 1 from public.mitgliedschaften m where m.verein_id = v.id);` — Ergebnis = Anzahl Vereine, die bewusst ohne Verwalter sind (in „Vereine & Gewerbe“ als „Kein Verwalter“ sichtbar).
