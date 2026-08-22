# Dashboard-Arbeitsset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Verlaufslisten im Verwaltungs-Dashboard laden nur noch ein begrenztes Arbeitsset aus der Datenbank; alles Ältere bleibt über eine aufklappbare, serverseitige Suche erreichbar.

**Architecture:** Jede Liste bekommt drei Bausteine — ein `.limit()` in der Abfrage statt `.slice()` im Browser, eine `count`-Abfrage für den sichtbaren Zähler, und eine `<AeltereSuche>`-Komponente, die gegen eine neue Route `/api/verwaltung/suche` sucht. Offene Vorgänge werden über eine zweite Statusabfrage ergänzt und mit einer reinen Merge-Funktion entdoppelt. Die KPI-Kacheln werden auf echte `count`-Aggregate umgestellt, weil sie heute aus den ungedeckelten Arrays gerechnet werden.

**Tech Stack:** Next.js 16 (App Router, Server Components), Supabase JS, Zod, Vitest, Tailwind v4.

**Grundlage:** `docs/superpowers/specs/2026-08-22-dashboard-arbeitsset-design.md`

**Abweichung von der Spec (bewusst):** Die Spec sah ein eigenes Zod-Schema in `src/lib/dashboardSuche.ts` und eine selbstgebaute Rollenprüfung vor. Beides existiert im Projekt bereits: Schemas leben in `src/lib/validations.ts`, Auth und Rollenprüfung erledigt `withAuth` aus `src/lib/api.ts`. Der Plan nutzt das Vorhandene.

---

### Task 1: Merge-Funktion für Arbeitssets

Reine Logik, die Basisliste und Statusausnahmen zu einer entdoppelten, sortierten Liste zusammenführt. Wird von Mängeln, Fragen, Warnmeldungen und Beiträgen genutzt.

**Files:**
- Create: `src/lib/dashboardArbeitsset.ts`
- Test: `src/lib/dashboardArbeitsset.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { mergeArbeitsset } from './dashboardArbeitsset'

type Zeile = { id: string; created_at: string | null }
const datum = (z: Zeile) => z.created_at

describe('mergeArbeitsset', () => {
  it('gibt bei leerer Eingabe eine leere Liste zurueck', () => {
    expect(mergeArbeitsset<Zeile>([], datum)).toEqual([])
    expect(mergeArbeitsset<Zeile>([[], []], datum)).toEqual([])
  })

  it('sortiert neueste zuerst', () => {
    const a = { id: 'a', created_at: '2026-08-01T10:00:00Z' }
    const b = { id: 'b', created_at: '2026-08-03T10:00:00Z' }
    const c = { id: 'c', created_at: '2026-08-02T10:00:00Z' }
    expect(mergeArbeitsset([[a, b, c]], datum).map(z => z.id)).toEqual(['b', 'c', 'a'])
  })

  it('entdoppelt ueber die id, auch wenn eine Zeile in mehreren Gruppen steckt', () => {
    const neu = { id: 'a', created_at: '2026-08-03T10:00:00Z' }
    const gleicheZeile = { id: 'a', created_at: '2026-08-03T10:00:00Z' }
    const alt = { id: 'b', created_at: '2026-01-01T10:00:00Z' }
    const ergebnis = mergeArbeitsset([[neu], [gleicheZeile, alt]], datum)
    expect(ergebnis.map(z => z.id)).toEqual(['a', 'b'])
  })

  it('behaelt den offenen Altfall, der nicht im Arbeitsset steckt', () => {
    const neueste = [
      { id: 'neu1', created_at: '2026-08-20T10:00:00Z' },
      { id: 'neu2', created_at: '2026-08-19T10:00:00Z' },
    ]
    const offeneAltfaelle = [{ id: 'alt', created_at: '2026-02-01T10:00:00Z' }]
    const ergebnis = mergeArbeitsset([neueste, offeneAltfaelle], datum)
    expect(ergebnis.map(z => z.id)).toEqual(['neu1', 'neu2', 'alt'])
  })

  it('sortiert Zeilen ohne Datum ans Ende', () => {
    const ohne = { id: 'ohne', created_at: null }
    const mit = { id: 'mit', created_at: '2026-08-01T10:00:00Z' }
    expect(mergeArbeitsset([[ohne, mit]], datum).map(z => z.id)).toEqual(['mit', 'ohne'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/dashboardArbeitsset.test.ts`
Expected: FAIL — `Failed to resolve import "./dashboardArbeitsset"`

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * Fuehrt mehrere Ergebnismengen zu einer Liste zusammen.
 *
 * Das Dashboard laedt je Liste ein begrenztes Arbeitsset (die neuesten N)
 * und ergaenzt es um Zeilen, die unabhaengig vom Alter sichtbar bleiben
 * muessen — offene Maengel, unbeantwortete Fragen, aktive Warnungen,
 * kommende Veranstaltungen. Diese Mengen ueberlappen sich, deshalb wird
 * ueber die id entdoppelt.
 *
 * Die erste Fundstelle einer id gewinnt.
 */
export function mergeArbeitsset<T extends { id: string }>(
  gruppen: T[][],
  datumVon: (eintrag: T) => string | null,
): T[] {
  const gesehen = new Set<string>()
  const zusammen: T[] = []

  for (const gruppe of gruppen) {
    for (const eintrag of gruppe) {
      if (gesehen.has(eintrag.id)) continue
      gesehen.add(eintrag.id)
      zusammen.push(eintrag)
    }
  }

  // Zeilen ohne Datum ans Ende, sonst neueste zuerst.
  return zusammen.sort((a, b) => {
    const da = datumVon(a)
    const db = datumVon(b)
    if (da === null && db === null) return 0
    if (da === null) return 1
    if (db === null) return -1
    return db.localeCompare(da)
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/dashboardArbeitsset.test.ts`
Expected: PASS — 5 Tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboardArbeitsset.ts src/lib/dashboardArbeitsset.test.ts
git commit -m "feat: Merge-Funktion fuer Dashboard-Arbeitssets"
```

---

### Task 2: ilike-Escaping für die Suche

Eingaben wie `50%` oder `A_B` würden sonst als Platzhalter interpretiert und liefern falsche Treffer.

**Files:**
- Create: `src/lib/dashboardSuche.ts`
- Test: `src/lib/dashboardSuche.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { escapeIlike, SUCH_TYPEN } from './dashboardSuche'

describe('escapeIlike', () => {
  it('laesst harmlosen Text unveraendert', () => {
    expect(escapeIlike('Sommerfest')).toBe('Sommerfest')
  })

  it('maskiert Prozentzeichen', () => {
    expect(escapeIlike('50%')).toBe('50\\%')
  })

  it('maskiert Unterstriche', () => {
    expect(escapeIlike('A_B')).toBe('A\\_B')
  })

  it('maskiert den Backslash zuerst, damit keine Doppelmaskierung entsteht', () => {
    expect(escapeIlike('a\\b')).toBe('a\\\\b')
  })

  it('maskiert mehrere Sonderzeichen gemeinsam', () => {
    expect(escapeIlike('%_%')).toBe('\\%\\_\\%')
  })
})

describe('SUCH_TYPEN', () => {
  it('enthaelt genau die vier unterstuetzten Listen', () => {
    expect(SUCH_TYPEN).toEqual(['beitraege', 'maengel', 'fragen', 'warnmeldungen'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/dashboardSuche.test.ts`
Expected: FAIL — `Failed to resolve import "./dashboardSuche"`

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * Suche im Verwaltungs-Dashboard.
 */

export const SUCH_TYPEN = ['beitraege', 'maengel', 'fragen', 'warnmeldungen'] as const
export type SuchTyp = (typeof SUCH_TYPEN)[number]

/**
 * Maskiert die ilike-Platzhalter % und _ sowie den Backslash selbst.
 * Ohne das liefert die Suche nach "50%" jeden Titel, der mit "50" beginnt.
 *
 * Der Backslash muss zuerst ersetzt werden, sonst maskiert der Aufruf die
 * eigenen frisch eingefuegten Backslashes ein zweites Mal.
 */
export function escapeIlike(eingabe: string): string {
  return eingabe
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/dashboardSuche.test.ts`
Expected: PASS — 6 Tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboardSuche.ts src/lib/dashboardSuche.test.ts
git commit -m "feat: ilike-Escaping fuer die Dashboard-Suche"
```

---

### Task 3: Zod-Schema für die Such-Parameter

Folgt der Projektkonvention: alle API-Schemas in `src/lib/validations.ts`, Tests in einer eigenen Datei (wie `validations.sammlung.test.ts`).

**Files:**
- Modify: `src/lib/validations.ts` (am Ende anfügen)
- Test: `src/lib/validations.dashboardSuche.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { dashboardSucheSchema } from './validations'

describe('dashboardSucheSchema', () => {
  it('akzeptiert gueltige Eingaben', () => {
    const r = dashboardSucheSchema.safeParse({ typ: 'beitraege', q: 'Sommerfest' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.q).toBe('Sommerfest')
  })

  it('entfernt umgebende Leerzeichen', () => {
    const r = dashboardSucheSchema.safeParse({ typ: 'maengel', q: '  Laterne  ' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.q).toBe('Laterne')
  })

  it('lehnt einen unbekannten Typ ab', () => {
    expect(dashboardSucheSchema.safeParse({ typ: 'umfragen', q: 'test' }).success).toBe(false)
  })

  it('lehnt weniger als zwei Zeichen ab', () => {
    expect(dashboardSucheSchema.safeParse({ typ: 'fragen', q: 'a' }).success).toBe(false)
  })

  it('lehnt ab, wenn nur Leerzeichen uebrig bleiben', () => {
    expect(dashboardSucheSchema.safeParse({ typ: 'fragen', q: '   ' }).success).toBe(false)
  })

  it('lehnt mehr als 100 Zeichen ab', () => {
    const r = dashboardSucheSchema.safeParse({ typ: 'fragen', q: 'x'.repeat(101) })
    expect(r.success).toBe(false)
  })

  it('lehnt fehlende Parameter ab', () => {
    expect(dashboardSucheSchema.safeParse({ typ: null, q: null }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/validations.dashboardSuche.test.ts`
Expected: FAIL — `dashboardSucheSchema is not exported` bzw. `undefined`

- [ ] **Step 3: Write minimal implementation**

Am Ende von `src/lib/validations.ts` anfügen (`SUCH_TYPEN`-Import oben zu den bestehenden Imports ergänzen):

```ts
// ── Dashboard-Suche ───────────────────────────────────────────────────────────

export const dashboardSucheSchema = z.object({
  typ: z.enum(SUCH_TYPEN),
  q: z.string()
    .transform(s => s.trim())
    .pipe(z.string()
      .min(2, 'Bitte mindestens zwei Zeichen eingeben')
      .max(100, 'Suchbegriff ist zu lang')),
})
```

Import oben in der Datei ergänzen:

```ts
import { SUCH_TYPEN } from '@/lib/dashboardSuche'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/validations.dashboardSuche.test.ts`
Expected: PASS — 7 Tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/validations.ts src/lib/validations.dashboardSuche.test.ts
git commit -m "feat: Zod-Schema fuer die Dashboard-Suche"
```

---

### Task 4: Such-Route

**Files:**
- Create: `src/app/api/verwaltung/suche/route.ts`

- [ ] **Step 1: Route anlegen**

```ts
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api'
import { validate, dashboardSucheSchema } from '@/lib/validations'
import { escapeIlike } from '@/lib/dashboardSuche'

const LIMIT = 20

/**
 * Suche ueber aeltere Eintraege im Verwaltungs-Dashboard.
 *
 * gemeinde_id und Rolle kommen aus withAuth, also serverseitig aus der
 * Session — niemals aus dem Request. Ein Vereins- oder Gewerbe-Account
 * erreicht diese Route dank der roles-Option gar nicht erst.
 */
export const GET = withAuth(
  async (req, { profile }) => {
    const { searchParams } = new URL(req.url)
    const v = validate(dashboardSucheSchema, {
      typ: searchParams.get('typ'),
      q: searchParams.get('q'),
    })
    if (!v.success) return v.error

    const { typ, q } = v.data
    const gemeindeId = profile.gemeinde_id
    if (!gemeindeId) {
      return NextResponse.json({ error: 'Kein Gemeindebezug' }, { status: 400 })
    }

    const service = await createServiceClient()
    // Ein Treffer mehr als noetig, um "es gibt noch mehr" zu erkennen.
    const muster = `%${escapeIlike(q)}%`
    const grenze = LIMIT + 1

    let zeilen: unknown[] = []

    if (typ === 'maengel') {
      const { data } = await service
        .from('maengel')
        .select('id, titel, status, created_at, profiles(display_name)')
        .eq('gemeinde_id', gemeindeId)
        .ilike('titel', muster)
        .order('created_at', { ascending: false })
        .limit(grenze)
      zeilen = data ?? []
    } else if (typ === 'fragen') {
      const { data } = await service
        .from('fragen')
        .select('id, frage, antwort, status, created_at, profiles(display_name)')
        .eq('gemeinde_id', gemeindeId)
        .ilike('frage', muster)
        .order('created_at', { ascending: false })
        .limit(grenze)
      zeilen = data ?? []
    } else if (typ === 'warnmeldungen') {
      const { data } = await service
        .from('posts')
        .select('id, titel, severity, is_active, dwd_id, created_at')
        .eq('gemeinde_id', gemeindeId)
        .eq('channel', 'warnung')
        .ilike('titel', muster)
        .order('created_at', { ascending: false })
        .limit(grenze)
      zeilen = data ?? []
    } else {
      const { data } = await service
        .from('posts')
        .select('id, titel, channel, tag, published_at, publish_at')
        .eq('gemeinde_id', gemeindeId)
        .eq('status', 'published')
        .neq('channel', 'warnung')
        .ilike('titel', muster)
        .order('published_at', { ascending: false })
        .limit(grenze)
      zeilen = data ?? []
    }

    return NextResponse.json({
      treffer: zeilen.slice(0, LIMIT),
      mehrVorhanden: zeilen.length > LIMIT,
    })
  },
  { roles: ['verwaltung', 'super_admin'] },
)
```

- [ ] **Step 2: Typen und Lint prüfen**

Run: `npx tsc --noEmit && npx eslint src/app/api/verwaltung/suche/route.ts`
Expected: keine Ausgabe

- [ ] **Step 3: Route manuell prüfen**

Dev-Server starten (`npm run dev`), als Verwaltungsnutzer eingeloggt im Browser aufrufen:

```
http://localhost:3000/api/verwaltung/suche?typ=beitraege&q=fest
```

Erwartet: `{"treffer":[...],"mehrVorhanden":false}`.
Ohne Login oder mit `typ=umfragen`: `401` bzw. `400` mit `Ungültige Eingabe`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/verwaltung/suche/route.ts
git commit -m "feat: Such-Route fuer aeltere Dashboard-Eintraege"
```

---

### Task 5: Komponente `AeltereSuche`

**Files:**
- Create: `src/components/dashboard/AeltereSuche.tsx`

- [ ] **Step 1: Komponente anlegen**

```tsx
'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Search, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import type { SuchTyp } from '@/lib/dashboardSuche'

interface Props<T> {
  typ: SuchTyp
  label: string
  children: (treffer: T[]) => React.ReactNode
}

/**
 * Aufklappbare Suche am Fuss einer Dashboard-Liste.
 *
 * Die Listen zeigen nur ein Arbeitsset. Aelteres wird selten gebraucht und
 * deshalb nicht mitgeladen, sondern hier serverseitig gesucht. Die
 * Trefferdarstellung liefert die aufrufende Section per children-Funktion,
 * damit diese Komponente nichts ueber die einzelnen Datentypen wissen muss.
 */
export default function AeltereSuche<T>({ typ, label, children }: Props<T>) {
  const [offen, setOffen] = useState(false)
  const [suchbegriff, setSuchbegriff] = useState('')
  const [treffer, setTreffer] = useState<T[] | null>(null)
  const [mehrVorhanden, setMehrVorhanden] = useState(false)
  const [laedt, setLaedt] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  const feldId = useId()
  const feldRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (offen) feldRef.current?.focus()
  }, [offen])

  useEffect(() => {
    const begriff = suchbegriff.trim()
    if (!offen || begriff.length < 2) {
      setTreffer(null)
      setFehler(null)
      return
    }

    const abbruch = new AbortController()
    const zeit = setTimeout(async () => {
      setLaedt(true)
      setFehler(null)
      try {
        const res = await fetch(
          `/api/verwaltung/suche?typ=${typ}&q=${encodeURIComponent(begriff)}`,
          { signal: abbruch.signal },
        )
        if (!res.ok) throw new Error()
        const daten = await res.json()
        setTreffer(daten.treffer as T[])
        setMehrVorhanden(Boolean(daten.mehrVorhanden))
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        setFehler('Suche fehlgeschlagen. Bitte erneut versuchen.')
        setTreffer(null)
      } finally {
        setLaedt(false)
      }
    }, 300)

    return () => { clearTimeout(zeit); abbruch.abort() }
  }, [suchbegriff, offen, typ])

  return (
    <div className="border-t border-gray-100">
      <button
        onClick={() => setOffen(o => !o)}
        aria-expanded={offen}
        className="w-full flex items-center gap-2 px-5 py-3 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
      >
        <Search className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left">{label}</span>
        {offen
          ? <ChevronUp className="w-4 h-4 shrink-0" aria-hidden="true" />
          : <ChevronDown className="w-4 h-4 shrink-0" aria-hidden="true" />}
      </button>

      {offen && (
        <div className="px-5 pb-4 space-y-3">
          <div>
            <label htmlFor={feldId} className="block text-xs font-semibold text-gray-600 mb-1">
              Suchbegriff
            </label>
            <input
              id={feldId}
              ref={feldRef}
              type="search"
              value={suchbegriff}
              onChange={e => setSuchbegriff(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>

          {fehler && (
            <p role="alert" className="text-sm text-red-600">{fehler}</p>
          )}

          <div aria-live="polite" className="text-xs text-gray-500">
            {laedt && (
              <span className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                Suche läuft …
              </span>
            )}
            {!laedt && treffer && treffer.length === 0 && 'Keine Treffer'}
            {!laedt && treffer && treffer.length > 0 && (
              mehrVorhanden
                ? `Mehr als ${treffer.length} Treffer — bitte Suche eingrenzen`
                : `${treffer.length} Treffer`
            )}
          </div>

          {treffer && treffer.length > 0 && children(treffer)}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typen und Lint prüfen**

Run: `npx tsc --noEmit && npx eslint src/components/dashboard/AeltereSuche.tsx`
Expected: keine Ausgabe

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/AeltereSuche.tsx
git commit -m "feat: aufklappbare Suche fuer aeltere Dashboard-Eintraege"
```

---

### Task 6: Mängel deckeln und KPI-Zählungen umstellen

Der kritische Task: Sobald die Mängel-Abfrage ein Limit bekommt, sind die KPI-Kacheln falsch. Beides gehört in einen Commit.

**Files:**
- Modify: `src/app/(admin)/dashboard/page.tsx`
- Modify: `src/components/dashboard/MaengelSection.tsx`

- [ ] **Step 1: Abfragen in `page.tsx` ersetzen**

Im `Promise.all` die `maengel`-Zeile durch drei Einträge ersetzen — Arbeitsset, offene Altfälle, Gesamtzahl:

```ts
    // Arbeitsset: die zehn neuesten Meldungen.
    supabase.from('maengel').select('id, titel, status, created_at, beschreibung, adresse, foto_url, lat, lng, nachricht_an_buerger, profiles(display_name)').eq('gemeinde_id', gemeindeId!).order('created_at', { ascending: false }).limit(10),
    // Unabhaengig vom Alter: alles, was noch offen ist.
    supabase.from('maengel').select('id, titel, status, created_at, beschreibung, adresse, foto_url, lat, lng, nachricht_an_buerger, profiles(display_name)').eq('gemeinde_id', gemeindeId!).neq('status', 'erledigt').order('created_at', { ascending: false }).limit(50),
    supabase.from('maengel').select('id', { count: 'exact', head: true }).eq('gemeinde_id', gemeindeId!),
```

Zusätzlich drei Zähl-Abfragen für die KPI-Kacheln:

```ts
    supabase.from('maengel').select('id', { count: 'exact', head: true }).eq('gemeinde_id', gemeindeId!).eq('status', 'offen'),
    supabase.from('maengel').select('id', { count: 'exact', head: true }).eq('gemeinde_id', gemeindeId!).eq('status', 'in_bearbeitung'),
    supabase.from('maengel').select('id', { count: 'exact', head: true }).eq('gemeinde_id', gemeindeId!).eq('status', 'erledigt'),
```

Die Destrukturierung des `Promise.all` um die neuen Namen erweitern:
`maengelArbeitssetResult, maengelOffeneResult, maengelGesamtResult, maengelOffenCountResult, maengelBearbeitungCountResult, maengelErledigtCountResult`.

- [ ] **Step 2: Ableitungen ersetzen**

Die vier `filter().length`-Zeilen (derzeit Zeilen 166–169) ersetzen:

```ts
import { mergeArbeitsset } from '@/lib/dashboardArbeitsset'

// ...

const maengel = mergeArbeitsset(
  [maengelArbeitssetResult.data ?? [], maengelOffeneResult.data ?? []],
  m => m.created_at,
)
const maengelGesamt = maengelGesamtResult.count ?? 0
const offeneMaengel = maengelOffenCountResult.count ?? 0
const inBearbeitung = maengelBearbeitungCountResult.count ?? 0
const erledigteMaengel = maengelErledigtCountResult.count ?? 0
```

`const offeneFragen = fragen.filter(...)` bleibt in diesem Task unverändert — Fragen kommen in Task 7.

- [ ] **Step 3: `MaengelSection` anpassen**

Die Zeile `const sichtbare = maengel.slice(0, 10)` entfernen und durch `const sichtbare = maengel` ersetzen — gedeckelt wird jetzt in der Abfrage. Props um `gesamt: number` erweitern und im Kopf anzeigen:

```tsx
<h2 className="font-bold text-gray-900 flex items-center gap-2">
  <AlertTriangle className="w-4 h-4 text-red-500" aria-hidden="true" />
  Meldungen
  <span className="text-xs text-gray-500 font-normal">
    {sichtbare.length} von {gesamt}
  </span>
</h2>
```

Am Ende der `<section>`, nach der Tabelle, die Suche einhängen:

```tsx
<AeltereSuche<Mangel> typ="maengel" label="Ältere Meldungen durchsuchen">
  {treffer => (
    <ul className="divide-y divide-gray-50">
      {treffer.map(m => (
        <li key={m.id} className="py-2 flex items-center justify-between gap-3">
          <span className="text-sm text-gray-800 truncate">{m.titel}</span>
          <span className="text-xs text-gray-500 shrink-0">
            {new Date(m.created_at).toLocaleDateString('de-DE')}
          </span>
        </li>
      ))}
    </ul>
  )}
</AeltereSuche>
```

In `page.tsx` das neue Prop übergeben: `gesamt={maengelGesamt}`.

- [ ] **Step 4: Prüfen**

Run: `npx tsc --noEmit && npm run test && npm run build`
Expected: keine Typfehler, 117+ Tests grün, Build erfolgreich

Danach im Dev-Server als Verwaltungsnutzer prüfen: Die Meldungsliste zeigt „N von M", die KPI-Kacheln zeigen dieselben Zahlen wie vorher, und ein offener Altfall bleibt in der Liste.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(admin)/dashboard/page.tsx" src/components/dashboard/MaengelSection.tsx
git commit -m "feat: Maengelliste deckeln, KPI-Zahlen auf Aggregate umstellen"
```

---

### Task 7: Fragen deckeln

**Files:**
- Modify: `src/app/(admin)/dashboard/page.tsx`
- Modify: `src/components/dashboard/BuergerfrageSection.tsx`

- [ ] **Step 1: Abfragen ersetzen**

Die `fragen`-Zeile im `Promise.all` durch drei Einträge ersetzen:

```ts
    supabase.from('fragen').select('id, frage, antwort, status, created_at, profiles(display_name)').eq('gemeinde_id', gemeindeId!).order('created_at', { ascending: false }).limit(10),
    supabase.from('fragen').select('id, frage, antwort, status, created_at, profiles(display_name)').eq('gemeinde_id', gemeindeId!).eq('status', 'offen').order('created_at', { ascending: false }).limit(50),
    supabase.from('fragen').select('id', { count: 'exact', head: true }).eq('gemeinde_id', gemeindeId!),
    supabase.from('fragen').select('id', { count: 'exact', head: true }).eq('gemeinde_id', gemeindeId!).eq('status', 'offen'),
```

Destrukturierung erweitern: `fragenArbeitssetResult, fragenOffeneResult, fragenGesamtResult, fragenOffenCountResult`.

- [ ] **Step 2: Ableitungen ersetzen**

```ts
const fragen = mergeArbeitsset(
  [fragenArbeitssetResult.data ?? [], fragenOffeneResult.data ?? []],
  f => f.created_at,
)
const fragenGesamt = fragenGesamtResult.count ?? 0
const offeneFragen = fragenOffenCountResult.count ?? 0
```

- [ ] **Step 3: `BuergerfrageSection` anpassen**

`{[...offene, ...beantwortet].slice(0, 10).map(f => {` → `{[...offene, ...beantwortet].map(f => {`

Prop `gesamt: number` ergänzen, im Kopf „N von M" anzeigen und am Ende der Section einhängen:

```tsx
<AeltereSuche<{ id: string; frage: string; created_at: string }>
  typ="fragen"
  label="Ältere Fragen durchsuchen"
>
  {treffer => (
    <ul className="divide-y divide-gray-50">
      {treffer.map(f => (
        <li key={f.id} className="py-2 flex items-center justify-between gap-3">
          <span className="text-sm text-gray-800 truncate">{f.frage}</span>
          <span className="text-xs text-gray-500 shrink-0">
            {new Date(f.created_at).toLocaleDateString('de-DE')}
          </span>
        </li>
      ))}
    </ul>
  )}
</AeltereSuche>
```

In `page.tsx` `gesamt={fragenGesamt}` übergeben.

- [ ] **Step 4: Prüfen**

Run: `npx tsc --noEmit && npm run test && npm run build`
Expected: alles grün

- [ ] **Step 5: Commit**

```bash
git add "src/app/(admin)/dashboard/page.tsx" src/components/dashboard/BuergerfrageSection.tsx
git commit -m "feat: Fragenliste deckeln und durchsuchbar machen"
```

---

### Task 8: Beiträge — Limit, kommende Veranstaltungen, Suche

**Files:**
- Modify: `src/app/(admin)/dashboard/page.tsx`
- Modify: `src/components/dashboard/PostVerwaltungSection.tsx`

- [ ] **Step 1: Abfragen ersetzen**

Die `posts`-Zeile mit `.limit(50)` durch vier Einträge ersetzen. `heute` vorher berechnen:

```ts
const heute = new Date().toISOString().split('T')[0]
const postSpalten = 'id, titel, inhalt, tag, channel, pinned, bild_url, veranstaltung_datum, veranstaltung_ort, post_termine(datum), published_at, publish_at, profiles(role)'
```

```ts
    // Arbeitsset: die 20 neuesten. Geplante Beitraege stehen automatisch oben,
    // weil published_at beim Freigeben auf publish_at gesetzt wird.
    service.from('posts').select(postSpalten).eq('gemeinde_id', gemeindeId!).eq('status', 'published').order('published_at', { ascending: false }).limit(20),
    // Kommende Veranstaltungen ueber das Haupt-Datum.
    service.from('posts').select(postSpalten).eq('gemeinde_id', gemeindeId!).eq('status', 'published').eq('tag', 'veranstaltung').gte('veranstaltung_datum', heute).order('veranstaltung_datum', { ascending: true }).limit(50),
    // Kommende Zusatztermine mehrtaegiger Veranstaltungen.
    service.from('post_termine').select(`datum, posts!inner(${postSpalten.replace('post_termine(datum), ', '')}, status, gemeinde_id)`).eq('posts.gemeinde_id', gemeindeId!).eq('posts.status', 'published').gte('datum', heute).order('datum', { ascending: true }).limit(50),
    service.from('posts').select('id', { count: 'exact', head: true }).eq('gemeinde_id', gemeindeId!).eq('status', 'published'),
```

Destrukturierung: `postsArbeitssetResult, postsVeranstaltungenResult, postsZusatztermineResult, postsGesamtResult`.

- [ ] **Step 2: Zusammenführen**

Die Zusatztermine liefern verschachtelte Beiträge; sie werden auf die Beitragsform zurückgeholt und **nicht** je Termin aufgefächert — im Dashboard soll jeder Beitrag einmal erscheinen. Das Entdoppeln übernimmt `mergeArbeitsset`.

```ts
const zusatzBeitraege = ((postsZusatztermineResult.data ?? []) as unknown as { posts: { id: string } }[])
  .map(zeile => zeile.posts)

const posts = mergeArbeitsset(
  [
    postsArbeitssetResult.data ?? [],
    postsVeranstaltungenResult.data ?? [],
    zusatzBeitraege,
  ] as { id: string; published_at: string | null }[][],
  p => p.published_at,
)
const postsGesamt = postsGesamtResult.count ?? 0
```

- [ ] **Step 3: `PostVerwaltungSection` anpassen**

Der Kopf zeigt bereits `({posts.length})`. Auf „N von M" erweitern, dazu Prop `gesamt: number`:

```tsx
<span className="text-xs text-gray-500 font-normal">({posts.length} von {gesamt})</span>
```

Am Ende der Section die Suche einhängen:

```tsx
<AeltereSuche<{ id: string; titel: string; published_at: string | null }>
  typ="beitraege"
  label="Ältere Beiträge durchsuchen"
>
  {treffer => (
    <ul className="divide-y divide-gray-50">
      {treffer.map(p => (
        <li key={p.id} className="py-2 flex items-center justify-between gap-3">
          <span className="text-sm text-gray-800 truncate">{p.titel}</span>
          <span className="text-xs text-gray-500 shrink-0">
            {p.published_at ? new Date(p.published_at).toLocaleDateString('de-DE') : '–'}
          </span>
        </li>
      ))}
    </ul>
  )}
</AeltereSuche>
```

In `page.tsx` `gesamt={postsGesamt}` übergeben.

- [ ] **Step 4: Prüfen**

Run: `npx tsc --noEmit && npm run test && npm run build`
Expected: alles grün

Im Dev-Server prüfen: Eine Veranstaltung mit Datum in der Zukunft, die vor Wochen angelegt wurde, erscheint in der Liste. Ein alter gewöhnlicher Beitrag erscheint nicht, ist aber über die Suche auffindbar.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(admin)/dashboard/page.tsx" src/components/dashboard/PostVerwaltungSection.tsx
git commit -m "feat: Beitragsliste deckeln, kommende Veranstaltungen behalten"
```

---

### Task 9: Warnmeldungen deckeln

**Files:**
- Modify: `src/app/(admin)/dashboard/page.tsx`
- Modify: `src/components/dashboard/WarnmeldungenSection.tsx`

- [ ] **Step 1: Abfrage ersetzen**

Der `warnmeldungenResult`-Block (derzeit Zeilen 138–146) wird zu drei Abfragen. Der `as any`-Cast bleibt wie im Bestand:

```ts
  const warnmeldungenDaten = profile.role === 'verwaltung'
    ? await Promise.all([
        (service.from('posts') as any)
          .select('id, titel, severity, is_active, dwd_id, created_at')
          .eq('gemeinde_id', gemeindeId!).eq('channel', 'warnung')
          .order('created_at', { ascending: false }).limit(10) as Promise<{ data: WarnRow[] | null }>,
        (service.from('posts') as any)
          .select('id, titel, severity, is_active, dwd_id, created_at')
          .eq('gemeinde_id', gemeindeId!).eq('channel', 'warnung').eq('is_active', true)
          .order('created_at', { ascending: false }).limit(50) as Promise<{ data: WarnRow[] | null }>,
        (service.from('posts') as any)
          .select('id', { count: 'exact', head: true })
          .eq('gemeinde_id', gemeindeId!).eq('channel', 'warnung') as Promise<{ count: number | null }>,
      ])
    : null

  const warnmeldungen: WarnRow[] = warnmeldungenDaten
    ? mergeArbeitsset(
        [warnmeldungenDaten[0].data ?? [], warnmeldungenDaten[1].data ?? []],
        w => w.created_at,
      )
    : []
  const warnmeldungenGesamt = warnmeldungenDaten?.[2].count ?? 0
  const aktiveWarnungenAnzahl = warnmeldungenDaten?.[1].data?.length ?? 0
```

- [ ] **Step 2: `WarnmeldungenSection` anpassen**

Prop `gesamt: number` ergänzen, „N von M" im Kopf anzeigen und die Suche am Ende einhängen:

```tsx
<AeltereSuche<{ id: string; titel: string; created_at: string }>
  typ="warnmeldungen"
  label="Ältere Warnmeldungen durchsuchen"
>
  {treffer => (
    <ul className="divide-y divide-gray-50">
      {treffer.map(w => (
        <li key={w.id} className="py-2 flex items-center justify-between gap-3">
          <span className="text-sm text-gray-800 truncate">{w.titel}</span>
          <span className="text-xs text-gray-500 shrink-0">
            {new Date(w.created_at).toLocaleDateString('de-DE')}
          </span>
        </li>
      ))}
    </ul>
  )}
</AeltereSuche>
```

In `page.tsx` `gesamt={warnmeldungenGesamt}` übergeben.

- [ ] **Step 3: Prüfen**

Run: `npx tsc --noEmit && npm run test && npm run lint && npm run build`
Expected: alles grün; die Lint-Ausgabe darf keine **neuen** Fehler gegenüber dem Ausgangsstand enthalten

- [ ] **Step 4: Commit**

```bash
git add "src/app/(admin)/dashboard/page.tsx" src/components/dashboard/WarnmeldungenSection.tsx
git commit -m "feat: Warnmeldungen deckeln und durchsuchbar machen"
```

---

### Task 10: Abschlussprüfung am Gerät

**Files:** keine Änderung

- [ ] **Step 1: Nutzlast messen**

Dev-Server starten, Dashboard als Verwaltungsnutzer laden, im Netzwerk-Tab die Größe des Dokuments notieren und mit dem Stand vor der Umstellung vergleichen. Erwartet: deutlich kleiner, weil Mängel und Fragen nicht mehr vollständig übertragen werden.

- [ ] **Step 2: Zahlen gegenprüfen**

In der Supabase-Konsole zählen:

```sql
select status, count(*) from maengel where gemeinde_id = '<id>' group by status;
```

Die KPI-Kacheln müssen dieselben Zahlen zeigen. Das ist die Kontrolle dafür, dass die Umstellung auf Aggregate korrekt ist — ein Fehler hier fällt in der Oberfläche sonst nicht auf.

- [ ] **Step 3: Suche prüfen**

Einen Beitrag suchen, der älter als die neuesten 20 ist. Erwartet: Treffer erscheint. Sonderzeichen `%` eingeben: keine Massentreffer.

- [ ] **Step 4: Layout prüfen**

Dashboard bei 320 px Breite prüfen — die neue Suchzeile darf keinen horizontalen Überlauf erzeugen:

```js
document.documentElement.scrollWidth - document.documentElement.clientWidth  // muss 0 sein
```

---

## Selbstprüfung des Plans

**Spec-Abdeckung:**

| Spec-Abschnitt | Task |
|---|---|
| 1. Muster (Limit, Zähler, Suche) | 6, 7, 8, 9 |
| 2. Arbeitsset je Liste + Statusausnahmen | 1, 6, 7, 8, 9 |
| 2. Kommende Veranstaltungen inkl. `post_termine` | 8 |
| 3. KPI-Zählungen auf Aggregate | 6 (Mängel), 7 (Fragen), 9 (Warnungen) |
| 4. Komponente `AeltereSuche` inkl. Barrierefreiheit | 5 |
| 5. Such-API | 4 |
| 6. Sicherheit (`gemeinde_id`/Rolle serverseitig) | 4 via `withAuth` |
| 7. Tests | 1, 2, 3 |
| Freigabe-Stapel bleibt ungedeckelt | bewusst kein Task |
| Umfragen unverändert | bewusst kein Task |

**Offene Punkte für die Umsetzung:**

- Die `posts!inner`-Select-Zeichenkette in Task 8 Schritt 1 baut auf `postSpalten` auf und entfernt daraus `post_termine(datum)`, weil eine Selbstreferenz im Join nicht funktioniert. Sollte PostgREST die Zeichenkette ablehnen, die Spaltenliste für den Join von Hand ausschreiben — Vorbild ist `src/app/(app)/veranstaltungen/page.tsx`.
- `WarnRow` ist in `page.tsx` bereits definiert und wird in Task 9 weiterverwendet.
