# Umfragen im Dashboard entlasten — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Dashboard-Aufruf kommt für Umfragen mit zwei Datenbankabfragen aus statt mit mehreren hundert, und Ergebnisse werden erst beim Aufklappen geladen.

**Architecture:** Die Auswertungslogik wandert aus `page.tsx` in eine reine, getestete Funktion. Eine neue Route liefert die Ergebnisse einer einzelnen Umfrage auf Abruf. Eine neue Sammel-RPC ersetzt die Einzelabfragen der Teilnehmerzahlen. Die Liste wird wie die vier anderen Dashboard-Listen gedeckelt und über die bestehende Suche erreichbar gehalten.

**Tech Stack:** Next.js 16 (App Router, Server Components), Supabase JS + PostgreSQL-RPC, Zod, Vitest, Tailwind v4.

**Grundlage:** `docs/superpowers/specs/2026-09-14-umfragen-dashboard-entlasten-design.md`

**Reihenfolge beim Ausrollen:** Task 2 liefert eine Migration, die **von Hand im Supabase-SQL-Editor** ausgeführt werden muss, **bevor** der Code deployt wird. Task 5 baut ein Sicherheitsnetz ein, falls die Reihenfolge rutscht.

---

### Task 1: Auswertungslogik herausziehen und testen

Die Umrechnung roher Antwortzeilen in Anzeigewerte steckt heute ungetestet in `page.tsx`. Sie wird 1:1 in eine reine Funktion überführt — **ohne Verhaltensänderung**.

**Files:**
- Create: `src/lib/umfrageErgebnisse.ts`
- Test: `src/lib/umfrageErgebnisse.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { berechneErgebnisse } from './umfrageErgebnisse'

describe('berechneErgebnisse', () => {
  it('gibt bei leerer Fragenliste eine leere Liste zurueck', () => {
    expect(berechneErgebnisse([], [])).toEqual([])
  })

  it('zaehlt ja_nein aus und rechnet Prozente', () => {
    const [e] = berechneErgebnisse(
      [{ id: 'f1', frage_text: 'Magst du?', typ: 'ja_nein' }],
      [
        { frage_id: 'f1', option_id: null, antwort_text: 'ja', anzahl: 3 },
        { frage_id: 'f1', option_id: null, antwort_text: 'nein', anzahl: 1 },
      ],
    )
    expect(e.gesamt_antworten).toBe(4)
    expect(e.optionen).toEqual([
      { label: 'Ja', anzahl: 3, prozent: 75 },
      { label: 'Nein', anzahl: 1, prozent: 25 },
    ])
  })

  it('liefert bei ja_nein ohne Antworten 0 Prozent statt NaN', () => {
    const [e] = berechneErgebnisse(
      [{ id: 'f1', frage_text: 'Magst du?', typ: 'ja_nein' }],
      [],
    )
    expect(e.gesamt_antworten).toBe(0)
    expect(e.optionen.map(o => o.prozent)).toEqual([0, 0])
  })

  it('bildet bei bewertung den gewichteten Durchschnitt und alle fuenf Stufen ab', () => {
    const [e] = berechneErgebnisse(
      [{ id: 'f1', frage_text: 'Wie gut?', typ: 'bewertung' }],
      [
        { frage_id: 'f1', option_id: null, antwort_text: '5', anzahl: 2 },
        { frage_id: 'f1', option_id: null, antwort_text: '3', anzahl: 2 },
      ],
    )
    expect(e.gesamt_antworten).toBe(4)
    expect(e.durchschnitt).toBe(4)
    expect(e.optionen).toHaveLength(5)
    expect(e.optionen.map(o => o.anzahl)).toEqual([0, 0, 2, 0, 2])
    expect(e.optionen.map(o => o.prozent)).toEqual([0, 0, 50, 0, 50])
  })

  it('liefert bei bewertung ohne Antworten Durchschnitt 0', () => {
    const [e] = berechneErgebnisse(
      [{ id: 'f1', frage_text: 'Wie gut?', typ: 'bewertung' }],
      [],
    )
    expect(e.durchschnitt).toBe(0)
    expect(e.optionen.map(o => o.prozent)).toEqual([0, 0, 0, 0, 0])
  })

  it('sortiert Auswahloptionen nach reihenfolge und zeigt auch Optionen ohne Stimmen', () => {
    const [e] = berechneErgebnisse(
      [{
        id: 'f1', frage_text: 'Welche?', typ: 'einzelauswahl',
        umfrage_optionen: [
          { id: 'o2', option_text: 'B', reihenfolge: 2 },
          { id: 'o1', option_text: 'A', reihenfolge: 1 },
        ],
      }],
      [{ frage_id: 'f1', option_id: 'o1', antwort_text: null, anzahl: 3 }],
    )
    expect(e.gesamt_antworten).toBe(3)
    expect(e.optionen).toEqual([
      { label: 'A', anzahl: 3, prozent: 100, option_id: 'o1' },
      { label: 'B', anzahl: 0, prozent: 0, option_id: 'o2' },
    ])
  })

  it('ordnet Antworten der richtigen Frage zu', () => {
    const ergebnisse = berechneErgebnisse(
      [
        { id: 'f1', frage_text: 'Erste', typ: 'ja_nein' },
        { id: 'f2', frage_text: 'Zweite', typ: 'ja_nein' },
      ],
      [{ frage_id: 'f2', option_id: null, antwort_text: 'ja', anzahl: 7 }],
    )
    expect(ergebnisse[0].gesamt_antworten).toBe(0)
    expect(ergebnisse[1].gesamt_antworten).toBe(7)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/umfrageErgebnisse.test.ts`
Expected: FAIL — `Failed to resolve import "./umfrageErgebnisse"`

- [ ] **Step 3: Write the implementation**

```ts
import type { FrageErgebnis } from '@/types/umfrage'

/** Eine Zeile aus der RPC `umfrage_ergebnisse`. */
export type ErgebnisZeile = {
  frage_id: string
  option_id: string | null
  antwort_text: string | null
  anzahl: number
}

/** Das, was die Auswertung von einer Frage braucht — bewusst schmaler als der DB-Typ. */
export type FrageEingabe = {
  id: string
  frage_text: string
  typ: string
  umfrage_optionen?: { id: string; option_text: string; reihenfolge: number }[]
}

/**
 * Rechnet die von der Datenbank ausgezaehlten Antwortzeilen in Anzeigewerte um.
 *
 * Die Funktion lag vorher inline im Dashboard und war ungetestet. Sie ist die
 * einzige Stelle mit echter Rechenlogik (Prozente, Rundung, gewichteter
 * Durchschnitt), deshalb liegt sie jetzt eigenstaendig und unter Test.
 *
 * Bei null Antworten wird durch 1 statt durch 0 geteilt — so entstehen 0 Prozent
 * statt NaN.
 */
export function berechneErgebnisse(
  fragen: FrageEingabe[],
  antworten: ErgebnisZeile[],
): FrageErgebnis[] {
  return fragen.map(frage => {
    const eigene = antworten.filter(a => a.frage_id === frage.id)

    if (frage.typ === 'ja_nein') {
      const ja = eigene.filter(a => a.antwort_text === 'ja').reduce((s, a) => s + a.anzahl, 0)
      const nein = eigene.filter(a => a.antwort_text === 'nein').reduce((s, a) => s + a.anzahl, 0)
      const teiler = ja + nein || 1
      return {
        frage_id: frage.id,
        frage_text: frage.frage_text,
        typ: 'ja_nein' as const,
        gesamt_antworten: ja + nein,
        optionen: [
          { label: 'Ja', anzahl: ja, prozent: Math.round((ja / teiler) * 100) },
          { label: 'Nein', anzahl: nein, prozent: Math.round((nein / teiler) * 100) },
        ],
      }
    }

    if (frage.typ === 'bewertung') {
      const summeAnzahl = eigene.reduce((s, a) => s + a.anzahl, 0)
      const summeGewichtet = eigene.reduce((s, a) => s + parseInt(a.antwort_text ?? '0') * a.anzahl, 0)
      return {
        frage_id: frage.id,
        frage_text: frage.frage_text,
        typ: 'bewertung' as const,
        gesamt_antworten: summeAnzahl,
        durchschnitt: summeAnzahl ? summeGewichtet / summeAnzahl : 0,
        optionen: [1, 2, 3, 4, 5].map(stufe => {
          const anzahl = eigene.find(a => parseInt(a.antwort_text ?? '') === stufe)?.anzahl ?? 0
          return { label: String(stufe), anzahl, prozent: Math.round((anzahl / (summeAnzahl || 1)) * 100) }
        }),
      }
    }

    const optionen = [...(frage.umfrage_optionen ?? [])].sort((a, b) => a.reihenfolge - b.reihenfolge)
    const gesamt = eigene.reduce((s, a) => s + a.anzahl, 0)
    const teiler = gesamt || 1
    return {
      frage_id: frage.id,
      frage_text: frage.frage_text,
      typ: frage.typ as 'einzelauswahl' | 'mehrfachauswahl',
      gesamt_antworten: gesamt,
      optionen: optionen.map(o => {
        const anzahl = eigene.find(a => a.option_id === o.id)?.anzahl ?? 0
        return { label: o.option_text, anzahl, prozent: Math.round((anzahl / teiler) * 100), option_id: o.id }
      }),
    }
  })
}
```

**Hinweis:** Das Original sortierte mit `(frage.umfrage_optionen ?? []).sort(...)` und veränderte damit das übergebene Array. Hier wird vorher kopiert (`[...]`) — eine reine Funktion soll ihre Eingabe nicht verändern. Verhalten nach außen identisch.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/umfrageErgebnisse.test.ts`
Expected: PASS — 7 Tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/umfrageErgebnisse.ts src/lib/umfrageErgebnisse.test.ts
git commit -m "feat: Auswertungslogik der Umfragen herausziehen und testen"
```

---

### Task 2: Migration für die Sammel-Abfrage der Teilnehmerzahlen

**Files:**
- Create: `supabase/migrations/062_umfrage_teilnehmer_anzahlen.sql`

- [ ] **Step 1: Migration schreiben**

```sql
-- 062_umfrage_teilnehmer_anzahlen.sql
-- Sammel-Variante von umfrage_teilnehmer_anzahl (049).
-- Das Dashboard brauchte bisher einen Aufruf pro Umfrage; diese Funktion
-- liefert alle Zahlen der eigenen Gemeinde in einem Aufruf.
--
-- Sicherheitsmodell identisch zu 049: security definer mit abgeschaltetem
-- row_security, aber intern auf die eigene Gemeinde und die Verwaltungsrolle
-- eingeschraenkt. Kein Parameter — die Gemeinde kommt aus der Session, nicht
-- aus dem Aufruf, damit niemand fremde Gemeinden abfragen kann.
-- Anonymitaet bleibt gewahrt: es werden nur Zahlen zurueckgegeben.

create or replace function public.umfrage_teilnehmer_anzahlen()
returns table (
  umfrage_id uuid,
  anzahl bigint
)
language sql
stable
security definer
set search_path to 'public'
set row_security to 'off'
as $$
  select t.umfrage_id, count(*) as anzahl
  from public.umfrage_teilnahmen t
  join public.umfragen u on u.id = t.umfrage_id
  where u.gemeinde_id = public.current_gemeinde_id()
    and public.is_verwaltung()
  group by t.umfrage_id
$$;

grant execute on function public.umfrage_teilnehmer_anzahlen() to authenticated;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/062_umfrage_teilnehmer_anzahlen.sql
git commit -m "feat: Sammel-Funktion fuer Umfrage-Teilnehmerzahlen"
```

- [ ] **Step 3: Migration einspielen — durch den Menschen**

Diese Migration muss **vor dem Deploy** im Supabase-SQL-Editor ausgeführt werden. Nach dem Ausführen prüfen:

```sql
select proname from pg_proc where proname = 'umfrage_teilnehmer_anzahlen';
```

Erwartet: eine Zeile. Erst danach darf der Code live gehen.

---

### Task 3: Route für die Ergebnisse einer einzelnen Umfrage

**Files:**
- Modify: `src/lib/validations.ts` (Schema am Ende anfügen)
- Create: `src/app/api/verwaltung/umfrage-ergebnisse/route.ts`
- Test: `src/lib/validations.umfrageErgebnisse.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { umfrageErgebnisseSchema } from './validations'

describe('umfrageErgebnisseSchema', () => {
  it('akzeptiert eine gueltige UUID', () => {
    const r = umfrageErgebnisseSchema.safeParse({
      umfrageId: '3f0c2a1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b',
    })
    expect(r.success).toBe(true)
  })

  it('lehnt eine ungueltige UUID ab', () => {
    expect(umfrageErgebnisseSchema.safeParse({ umfrageId: 'abc' }).success).toBe(false)
  })

  it('lehnt einen fehlenden Parameter ab', () => {
    expect(umfrageErgebnisseSchema.safeParse({ umfrageId: null }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/validations.umfrageErgebnisse.test.ts`
Expected: FAIL — `umfrageErgebnisseSchema` ist undefined

- [ ] **Step 3: Schema anfügen**

Am Ende von `src/lib/validations.ts`:

```ts
// ── Umfrage-Ergebnisse ────────────────────────────────────────────────────────

export const umfrageErgebnisseSchema = z.object({
  umfrageId: uuid,
})
```

`uuid` ist das bereits vorhandene Primitive am Dateianfang (`z.string().uuid('Ungültige ID')`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/validations.umfrageErgebnisse.test.ts`
Expected: PASS — 3 Tests

- [ ] **Step 5: Route anlegen**

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withAuth, apiError } from '@/lib/api'
import { validate, umfrageErgebnisseSchema } from '@/lib/validations'
import { berechneErgebnisse, type ErgebnisZeile } from '@/lib/umfrageErgebnisse'

/**
 * Ergebnisse einer einzelnen Umfrage — wird erst beim Aufklappen abgerufen.
 *
 * Bewusst der RLS-gebundene Nutzer-Client, nicht der Service-Client: Die RPC
 * umfrage_ergebnisse prueft intern ueber current_gemeinde_id() und
 * is_verwaltung(), beides leitet sich aus der Session ab. Mit dem
 * Service-Client waeren diese Pruefungen wirkungslos.
 */
export const GET = withAuth(
  async (req, { profile }) => {
    const { searchParams } = new URL(req.url)
    const v = validate(umfrageErgebnisseSchema, { umfrageId: searchParams.get('umfrageId') })
    if (!v.success) return v.error

    const { umfrageId } = v.data
    const gemeindeId = profile.gemeinde_id
    if (!gemeindeId) return apiError('Kein Gemeindebezug', 400)

    const supabase = await createClient()

    // Zusaetzliche Absicherung: Die Umfrage muss zur eigenen Gemeinde gehoeren.
    // Die RPC prueft das ebenfalls, aber die Route verlaesst sich nicht darauf.
    const { data: umfrage, error: umfrageFehler } = await supabase
      .from('umfragen')
      .select('id, umfrage_fragen(id, frage_text, typ, umfrage_optionen(id, option_text, reihenfolge))')
      .eq('id', umfrageId)
      .eq('gemeinde_id', gemeindeId)
      .maybeSingle()

    if (umfrageFehler) {
      console.error('[umfrage-ergebnisse] Abfrage fehlgeschlagen:', umfrageFehler.message)
      return apiError('Ergebnisse konnten nicht geladen werden')
    }
    if (!umfrage) return apiError('Umfrage nicht gefunden', 404)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: antworten, error: rpcFehler } = await (supabase.rpc as any)(
      'umfrage_ergebnisse',
      { p_umfrage_id: umfrageId },
    )

    if (rpcFehler) {
      console.error('[umfrage-ergebnisse] RPC fehlgeschlagen:', rpcFehler.message)
      return apiError('Ergebnisse konnten nicht geladen werden')
    }

    const fragen = (umfrage.umfrage_fragen ?? []) as {
      id: string; frage_text: string; typ: string
      umfrage_optionen?: { id: string; option_text: string; reihenfolge: number }[]
    }[]

    return NextResponse.json({
      ergebnisse: berechneErgebnisse(fragen, (antworten ?? []) as ErgebnisZeile[]),
    })
  },
  { roles: ['verwaltung', 'super_admin'] },
)
```

- [ ] **Step 6: Prüfen**

Run: `npx tsc --noEmit && npx eslint src/app/api/verwaltung/umfrage-ergebnisse/route.ts && npx vitest run`
Expected: keine Fehler, alle Tests grün

- [ ] **Step 7: Commit**

```bash
git add src/lib/validations.ts src/lib/validations.umfrageErgebnisse.test.ts src/app/api/verwaltung/umfrage-ergebnisse/route.ts
git commit -m "feat: Route fuer Umfrage-Ergebnisse auf Abruf"
```

---

### Task 4: Umfragen als fünften Suchtyp

Deckeln ohne Suchzugriff würde ältere Umfragen unerreichbar machen. Bei drei sichtbaren Einträgen fällt eine beendete Umfrage besonders schnell heraus.

**Files:**
- Modify: `src/lib/dashboardSuche.ts`
- Modify: `src/lib/dashboardSuche.test.ts`
- Modify: `src/lib/validations.dashboardSuche.test.ts`
- Modify: `src/app/api/verwaltung/suche/route.ts`

- [ ] **Step 1: Bestehende Tests anpassen — sie brechen durch die Änderung**

Zwei Tests gehen von genau vier Typen aus und müssen mitgezogen werden.

In `src/lib/dashboardSuche.test.ts` den `SUCH_TYPEN`-Test ersetzen:

```ts
describe('SUCH_TYPEN', () => {
  it('enthaelt genau die fuenf unterstuetzten Listen', () => {
    expect(SUCH_TYPEN).toEqual(['beitraege', 'maengel', 'fragen', 'warnmeldungen', 'umfragen'])
  })
})
```

In `src/lib/validations.dashboardSuche.test.ts` nutzt der Test für den ungültigen Typ bisher ausgerechnet `'umfragen'` — dieser Wert wird jetzt gültig. Ersetzen durch:

```ts
  it('lehnt einen unbekannten Typ ab', () => {
    expect(dashboardSucheSchema.safeParse({ typ: 'abfallkalender', q: 'test' }).success).toBe(false)
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/dashboardSuche.test.ts src/lib/validations.dashboardSuche.test.ts`
Expected: FAIL — `SUCH_TYPEN` enthält erst vier Werte

- [ ] **Step 3: Typ ergänzen**

In `src/lib/dashboardSuche.ts`:

```ts
export const SUCH_TYPEN = ['beitraege', 'maengel', 'fragen', 'warnmeldungen', 'umfragen'] as const
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/dashboardSuche.test.ts src/lib/validations.dashboardSuche.test.ts`
Expected: PASS

- [ ] **Step 5: Zweig in der Such-Route ergänzen**

In `src/app/api/verwaltung/suche/route.ts` vor dem abschließenden `else`-Zweig, der unbekannte Typen abweist, einen weiteren `else if` einfügen:

```ts
    } else if (typ === 'umfragen') {
      const { data, error } = await service
        .from('umfragen')
        .select('id, titel, enddatum, created_at')
        .eq('gemeinde_id', gemeindeId)
        .ilike('titel', muster)
        .order('created_at', { ascending: false })
        .limit(grenze)
      zeilen = data ?? []
      fehler = error?.message ?? null
```

Die genaue Schreibweise der Fehlerbehandlung an die der bestehenden Zweige angleichen — die Datei sammelt `fehler` in einer gemeinsamen Variablen und prüft sie einmal nach der Kette.

- [ ] **Step 6: Prüfen**

Run: `npx tsc --noEmit && npx eslint src/app/api/verwaltung/suche/route.ts && npx vitest run && npm run build`
Expected: alles grün

- [ ] **Step 7: Commit**

```bash
git add src/lib/dashboardSuche.ts src/lib/dashboardSuche.test.ts src/lib/validations.dashboardSuche.test.ts src/app/api/verwaltung/suche/route.ts
git commit -m "feat: Umfragen als fuenften Suchtyp ergaenzen"
```

---

### Task 5: Dashboard — Liste deckeln, Teilnehmerzahlen sammeln, Auswertung entfernen

**Files:**
- Modify: `src/app/(admin)/dashboard/page.tsx`

- [ ] **Step 1: Ladefunktion anlegen**

Dem Muster der bestehenden Ladefunktionen folgen (`ladeMaengelDaten`, `ladeFragenDaten`, `ladePostsDaten`, `ladeWarnmeldungenDaten` — alle in derselben Datei). Neue Funktion daneben:

```ts
async function ladeUmfragenDaten(supabase: SupabaseServerClient, gemeindeId: string) {
  const jetzt = new Date().toISOString()
  const umfrageSpalten = 'id, titel, enddatum, created_at'

  const [arbeitsset, laufende, gesamt, laufendCount, teilnehmer] = await Promise.all([
    supabase.from('umfragen').select(umfrageSpalten).eq('gemeinde_id', gemeindeId)
      .order('created_at', { ascending: false }).limit(3),
    // Laufende bleiben unabhaengig vom Alter sichtbar — sie brauchen Aufmerksamkeit.
    supabase.from('umfragen').select(umfrageSpalten).eq('gemeinde_id', gemeindeId)
      .gte('enddatum', jetzt).order('created_at', { ascending: false }).limit(50),
    supabase.from('umfragen').select('id', { count: 'exact', head: true }).eq('gemeinde_id', gemeindeId),
    supabase.from('umfragen').select('id', { count: 'exact', head: true })
      .eq('gemeinde_id', gemeindeId).gte('enddatum', jetzt),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.rpc as any)('umfrage_teilnehmer_anzahlen'),
  ])

  // Sicherheitsnetz: Ist die Migration 062 noch nicht eingespielt, schlaegt nur
  // dieser eine Aufruf fehl. Dann fehlen die Teilnehmerzahlen, statt dass die
  // gesamte Dashboard-Seite scheitert.
  if (teilnehmer.error) {
    console.error('[dashboard] umfrage_teilnehmer_anzahlen nicht verfuegbar:', teilnehmer.error.message)
  }

  const teilnehmerJeUmfrage = new Map<string, number>(
    ((teilnehmer.data ?? []) as { umfrage_id: string; anzahl: number }[])
      .map(zeile => [zeile.umfrage_id, Number(zeile.anzahl)]),
  )

  const liste = mergeArbeitsset(
    [arbeitsset.data ?? [], laufende.data ?? []],
    u => u.created_at,
  )

  return {
    umfragen: liste.map(umfrage => ({
      umfrage,
      teilnehmer: teilnehmerJeUmfrage.get(umfrage.id) ?? 0,
    })),
    gesamt: gesamt.count ?? 0,
    laufendeVerborgen: Math.max(0, (laufendCount.count ?? 0) - (laufende.data?.length ?? 0)),
  }
}
```

- [ ] **Step 2: Alte Abfrage und Auswertung entfernen**

In `page.tsx`:

1. Im äußeren `Promise.all` die `umfragen`-Zeile
   (`supabase.from('umfragen').select('*, umfrage_fragen(*, umfrage_optionen(*))')…`)
   durch `ladeUmfragenDaten(supabase, gemeindeId!)` ersetzen und den
   Destrukturierungsnamen von `umfragenResult` auf `umfragenDaten` ändern.
2. `const umfragen = umfragenResult.data ?? []` entfernen.
3. Den gesamten Block `const umfragenMitErgebnissen = await Promise.all(umfragen.map(...))`
   samt der lokalen `type ErgebnisZeile`-Zeile **ersatzlos löschen** — die
   Auswertung passiert jetzt in der Route aus Task 3.
4. Den Import von `FrageErgebnis` aus `@/types/umfrage` entfernen, falls er
   danach unbenutzt ist.

- [ ] **Step 3: Props an die Section anpassen**

```tsx
{gemeindeId && (
  <UmfragenSection
    umfragen={umfragenDaten.umfragen}
    gesamt={umfragenDaten.gesamt}
    laufendeVerborgen={umfragenDaten.laufendeVerborgen}
    gemeindeId={gemeindeId}
    haushalte={gemeinde?.haushalte ?? null}
  />
)}
```

Der bisherige `as unknown as Parameters<...>`-Cast entfällt, weil die Form jetzt zusammenpasst. Bleibt ein Typfehler, **nicht** mit `any` überdecken, sondern den Props-Typ in Task 6 passend definieren.

- [ ] **Step 4: Prüfen**

Run: `npx tsc --noEmit`
Erwartet: Fehler in `UmfragenSection`, weil die Props dort noch nicht angepasst sind. Das ist an dieser Stelle in Ordnung — Task 6 behebt es. Erst nach Task 6 muss `tsc` sauber sein.

---

### Task 6: `UmfragenSection` — Ergebnisse auf Abruf, Zähler, Suche

**Files:**
- Modify: `src/components/dashboard/UmfragenSection.tsx`

- [ ] **Step 1: Props und Zustand umstellen**

Der Props-Typ nimmt keine `ergebnisse` mehr entgegen:

```tsx
interface Props {
  umfragen: { umfrage: { id: string; titel: string; enddatum: string; created_at: string }; teilnehmer: number }[]
  gesamt: number
  laufendeVerborgen: number
  gemeindeId: string
  haushalte: number | null
}
```

Zustand für die nachgeladenen Ergebnisse ergänzen:

```tsx
const [ergebnisse, setErgebnisse] = useState<Record<string, FrageErgebnis[]>>({})
const [laden, setLaden] = useState<string | null>(null)
const [fehler, setFehler] = useState<string | null>(null)
```

- [ ] **Step 2: Nachladen beim Aufklappen**

Das Aufklappen läuft bisher über `setExpandedId(...)` in zwei Buttons. Beide rufen stattdessen eine gemeinsame Funktion:

```tsx
async function toggle(umfrageId: string) {
  if (expandedId === umfrageId) {
    setExpandedId(null)
    return
  }
  setExpandedId(umfrageId)
  setFehler(null)

  // Schon geladen? Dann nicht erneut anfragen.
  if (ergebnisse[umfrageId]) return

  setLaden(umfrageId)
  try {
    const res = await fetch(`/api/verwaltung/umfrage-ergebnisse?umfrageId=${umfrageId}`)
    if (!res.ok) throw new Error()
    const daten = await res.json()
    setErgebnisse(prev => ({ ...prev, [umfrageId]: daten.ergebnisse as FrageErgebnis[] }))
  } catch {
    setFehler('Ergebnisse konnten nicht geladen werden.')
  } finally {
    setLaden(null)
  }
}
```

Import ergänzen: `import type { FrageErgebnis } from '@/types/umfrage'`

- [ ] **Step 3: Anzeige der Ergebnisse umstellen**

Der bestehende Block `{abgelaufen && isOpen && (<div className="px-5 pb-5 space-y-4">{ergebnisse.map(...)}</div>)}` nutzt bisher die per Prop gelieferten `ergebnisse`. Er greift jetzt auf den Zustand zu und bekommt Lade- und Fehlerzustand davor:

```tsx
{abgelaufen && isOpen && (
  <div className="px-5 pb-5 space-y-4">
    {laden === umfrage.id && (
      <p className="text-xs text-gray-500 flex items-center gap-1" aria-live="polite">
        <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
        Ergebnisse werden geladen …
      </p>
    )}
    {fehler && laden !== umfrage.id && !ergebnisse[umfrage.id] && (
      <p role="alert" className="text-sm text-red-600">{fehler}</p>
    )}
    {(ergebnisse[umfrage.id] ?? []).map(ergebnis => (
      /* unveraenderter Darstellungsblock aus dem Bestand */
    ))}
  </div>
)}
```

Der innere Darstellungsblock (Balken, Sterne, Prozente) bleibt **unverändert** — nur die Quelle der Daten ändert sich von `ergebnisse` (Prop) auf `ergebnisse[umfrage.id]` (Zustand). `Loader2` aus `lucide-react` importieren, falls noch nicht vorhanden.

- [ ] **Step 4: Zähler, Hinweis und Suche**

Im Kopf der Section „N von M" ergänzen, im Stil von `MaengelSection`:

```tsx
<span className="text-xs text-gray-500 font-normal">{umfragen.length} von {gesamt}</span>
```

Der bestehende `({umfragen.length})`-Span mit `text-gray-400` entfällt dafür.

Vor dem Ende der Section, falls die Deckelung greift:

```tsx
{laufendeVerborgen > 0 && (
  <p className="px-5 pb-3 text-xs text-gray-500">
    {laufendeVerborgen} weitere laufende Umfragen — bitte über die Suche aufrufen
  </p>
)}
```

Am Ende der Section die Suche einhängen:

```tsx
<AeltereSuche<{ id: string; titel: string; created_at: string }>
  typ="umfragen"
  label="Ältere Umfragen durchsuchen"
>
  {treffer => (
    <ul className="divide-y divide-gray-50">
      {treffer.map(u => (
        <li key={u.id} className="py-2 flex items-center justify-between gap-3">
          <span className="text-sm text-gray-800 truncate">{u.titel}</span>
          <span className="text-xs text-gray-500 shrink-0">
            {new Date(u.created_at).toLocaleDateString('de-DE')}
          </span>
        </li>
      ))}
    </ul>
  )}
</AeltereSuche>
```

Import ergänzen: `import AeltereSuche from '@/components/dashboard/AeltereSuche'`

- [ ] **Step 5: Prüfen**

Run: `npx tsc --noEmit && npx eslint "src/app/(admin)/dashboard/page.tsx" src/components/dashboard/UmfragenSection.tsx && npx vitest run && npm run build`
Expected: alles sauber, keine neuen Lint-Meldungen

**Achtung bei `setState` in Effekten:** Das Projekt erzwingt `react-hooks/set-state-in-effect`. Die Nachlade-Logik oben läuft bewusst in einem Event-Handler, nicht in einem `useEffect` — dabei bleiben.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(admin)/dashboard/page.tsx" src/components/dashboard/UmfragenSection.tsx
git commit -m "feat: Umfragen deckeln, Ergebnisse erst beim Aufklappen laden"
```

---

### Task 7: Abschlussprüfung

**Files:** keine Änderung

- [ ] **Step 1: Gesamtprüfung**

Run: `npx tsc --noEmit && npx vitest run && npm run lint && npm run build`

Erwartet: keine Typfehler, alle Tests grün, Build erfolgreich. Die Lint-Ausgabe darf gegenüber dem Stand vor diesem Plan keine **neuen** Meldungen enthalten.

- [ ] **Step 2: Anzahl der Datenbankaufrufe gegenprüfen**

Im Code nachzählen: Für Umfragen dürfen beim Seitenaufruf nur noch die Abfragen aus `ladeUmfragenDaten` laufen — vier Tabellenabfragen (zwei davon reine Counts) plus ein RPC-Aufruf, unabhängig von der Anzahl der Umfragen. Es darf **kein** Aufruf mehr pro Umfrage übrig sein.

Prüfen mit: `grep -n "umfrage_ergebnisse\|umfrage_teilnehmer_anzahl\b" "src/app/(admin)/dashboard/page.tsx"`
Erwartet: keine Treffer.

- [ ] **Step 3: Am Gerät prüfen — durch den Menschen**

1. **Migration zuerst einspielen** (Task 2, Step 3), sonst fehlen die Teilnehmerzahlen.
2. Dashboard öffnen: Zeigt die Umfragen-Liste höchstens drei beendete plus alle laufenden? Steht „N von M" im Kopf?
3. Eine **beendete** Umfrage aufklappen: Erscheinen die Ergebnisse nach kurzem Laden? Stimmen Prozente und Durchschnitt mit dem überein, was vorher angezeigt wurde?
4. Dieselbe Umfrage zu- und wieder aufklappen: Kein erneutes Laden.
5. Eine **laufende** Umfrage: Weiterhin der Hinweis „Ergebnisse erst nach Abschluss sichtbar", kein Aufklappen möglich.
6. „Ältere Umfragen durchsuchen": Findet sie eine beendete Umfrage, die nicht mehr in der Liste steht?

---

## Selbstprüfung des Plans

**Spec-Abdeckung:**

| Spec-Abschnitt | Task |
|---|---|
| 1. Ergebnisse erst beim Aufklappen laden | 3 (Route), 6 (Komponente) |
| 2. Auswertungslogik herausziehen und testen | 1 |
| 3. Teilnehmerzahlen in einer Abfrage | 2 (Migration), 5 (Aufruf) |
| 4. Liste deckeln (3 neueste + laufende, limit 50) | 5 |
| 5. Suche für Umfragen | 4 |
| 6. Reihenfolge beim Ausrollen + Sicherheitsnetz | 2 Step 3, 5 Step 1, 7 Step 3 |
| 7. Tests | 1, 3, 4 |

**Typkonsistenz geprüft:** `berechneErgebnisse(fragen, antworten)` aus Task 1 wird in Task 3 mit genau dieser Signatur aufgerufen. `ErgebnisZeile` und `FrageEingabe` werden in Task 1 definiert und in Task 3 importiert. `umfrageErgebnisseSchema` (Task 3) und `SUCH_TYPEN` (Task 4) stimmen mit ihren Verwendungen überein. Das Rückgabeobjekt von `ladeUmfragenDaten` (Task 5) passt zum Props-Typ in Task 6 (`umfragen`, `gesamt`, `laufendeVerborgen`).

**Bekannter Zwischenzustand:** Nach Task 5 ist `tsc` kurzzeitig rot, weil die Props von `UmfragenSection` erst in Task 6 nachgezogen werden. Das ist im Plan an beiden Stellen vermerkt. Die Tasks 5 und 6 gehören in einen gemeinsamen Commit-Zyklus und sollten nicht getrennt ausgeliefert werden.
