# Abfallkalender: Sammlungstermine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verwaltung und Vereine/Organisationen können über die bestehende Beitrags-Erstellung eine neue Kategorie „Sammlung" (Altpapier/Altkleider/Altglas/Schrott) anlegen, die automatisch im Bürger-Abfallkalender erscheint, dort filterbar ist und Push-/E-Mail-Erinnerungen auslösen kann.

**Architektur:** Drei neue nullable Spalten auf `posts` (`sammlung_art`, `sammlung_datum`, `sammlung_organisator`) + ein CHECK-Constraint. Keine neue Tabelle, kein Sync-Code: Bürger-Kalender und Cron-Job fragen direkt `posts WHERE tag = 'sammlung' AND status = 'published'` ab, da `posts` bereits dieselbe öffentliche Sichtbarkeit hat wie `abfalltermine`. Referenz-Spec: [docs/superpowers/specs/2026-07-14-abfallkalender-sammlungen-design.md](../specs/2026-07-14-abfallkalender-sammlungen-design.md).

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase (Postgres + PostgREST + RLS), Zod, Vitest.

---

## Wichtiger Kontext für den Umsetzer

- Die Spec nennt in Abschnitt C fälschlich `VereinPostForm.tsx` als zu ändernde Komponente — das ist **totes Code, nirgends importiert**. Die tatsächlich aktive Komponente für Vereine/Organisationen ist `VereinPostVerwaltung.tsx`. Dieser Plan zielt korrekt auf `VereinPostVerwaltung.tsx`.
- **Editieren von Sammlungs-Feldern nach Erstellung wird bewusst nicht unterstützt**: Der PATCH-Pfad `/api/verein/post` (`vereinPostUpdateSchema`) bleibt unverändert und fasst `sammlung_art`/`sammlung_datum`/`sammlung_organisator` nie an — dadurch bleiben diese Spalten bei jedem Edit unangetastet (kein Risiko, den CHECK-Constraint durch ein Edit zu verletzen). Die UI zeigt beim Bearbeiten eines bestehenden Sammlungs-Beitrags einen Hinweistext statt editierbarer Felder.
- `PostVerwaltungSection.tsx` (Verwaltungs-Ansicht „Beiträge verwalten", editiert *bestehende* Posts aller Kanäle) bekommt **kein** `sammlung`-Tag in seiner eigenen `TAGS`-Auswahl — dessen `/api/posts/update`-Aufruf (`postUpdateSchema`) kennt `sammlung_art`/`sammlung_datum`/`sammlung_organisator` ohnehin nicht und lässt sie unverändert, ein Hinzufügen des Tags dort würde nur unnötige Verwirrung stiften (Sammlungen werden ausschließlich über `PostErstellenButton.tsx` und `VereinPostVerwaltung.tsx` neu angelegt).

---

## Task 1: Migration — neue Spalten, CHECK-Constraint, Index auf `posts`

**Files:**
- Create: `supabase/migrations/051_posts_sammlung_felder.sql`

- [ ] **Step 1: Migration schreiben**

```sql
-- Sammlungstermine (Altpapier-, Altkleider-, Altglas-, Schrottsammlung) als neue
-- Beitragskategorie "sammlung". Keine neue Tabelle: Bürger-Kalender und Cron-Job
-- fragen posts direkt ab (siehe docs/superpowers/specs/2026-07-14-abfallkalender-sammlungen-design.md).
-- Keine neuen GRANTs nötig — bestehende Grants auf public.posts
-- (012_explicit_grants.sql, 030_posts_service_role_grants.sql) decken die neuen Spalten ab.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS sammlung_art         text,
  ADD COLUMN IF NOT EXISTS sammlung_datum       date,
  ADD COLUMN IF NOT EXISTS sammlung_organisator text;

DO $$
BEGIN
  ALTER TABLE public.posts
    ADD CONSTRAINT posts_sammlung_felder_check
    CHECK (
      tag <> 'sammlung'
      OR (
        sammlung_art IN ('altpapier', 'altkleider', 'altglas', 'schrott')
        AND sammlung_datum IS NOT NULL
        AND sammlung_organisator IS NOT NULL
        AND length(trim(sammlung_organisator)) > 0
      )
    );
EXCEPTION WHEN duplicate_object THEN
  NULL; -- Constraint existiert bereits, nichts zu tun
END $$;

-- Für Bürger-Kalender-Abfrage und Cron-Benachrichtigungen
CREATE INDEX IF NOT EXISTS idx_posts_sammlung
  ON public.posts (gemeinde_id, sammlung_datum)
  WHERE tag = 'sammlung' AND status = 'published';
```

- [ ] **Step 2: Migration gegen das Supabase-Projekt anwenden**

Run: `npx supabase db push`

Erwartete Ausgabe: Bestätigung, dass `051_posts_sammlung_felder.sql` angewendet wurde (keine Fehler). Falls der Supabase-CLI-Link in dieser Umgebung nicht konfiguriert ist, die Migration alternativ über den SQL-Editor im Supabase-Dashboard einspielen.

- [ ] **Step 3: Spalten verifizieren**

Run (im Supabase SQL-Editor oder via `psql`):
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'posts' AND column_name LIKE 'sammlung%';
```
Erwartet: drei Zeilen — `sammlung_art` (text), `sammlung_datum` (date), `sammlung_organisator` (text).

- [ ] **Step 4: TypeScript-Typen regenerieren**

Run: `npm run db:types`

Erwartete Ausgabe: `src/types/supabase.ts` wird aktualisiert und enthält `sammlung_art`, `sammlung_datum`, `sammlung_organisator` als `string | null` im `posts`-Row-Typ. Mit `git diff src/types/supabase.ts` prüfen, dass genau diese drei Felder neu hinzugekommen sind.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/051_posts_sammlung_felder.sql src/types/supabase.ts
git commit -m "feat: Sammlung-Felder auf posts-Tabelle für Abfallkalender-Sammlungen"
```

---

## Task 2: Gemeinsame Sammlung-Konfiguration und Merge-Logik

**Files:**
- Create: `src/lib/abfallkalenderSammlung.ts`
- Create: `src/lib/abfallkalenderSammlung.test.ts`

- [ ] **Step 1: Failing Test schreiben**

```typescript
// src/lib/abfallkalenderSammlung.test.ts
import { describe, it, expect } from 'vitest'
import {
  SAMMLUNG_ART_OPTIONEN,
  SAMMLUNG_ART_CONFIG,
  SAMMLUNG_PRAEFERENZ_SCHLUESSEL,
  sammlungPraeferenzSchluessel,
  mapSammlungPostsZuTerminen,
  getTerminAnzeigeConfig,
} from './abfallkalenderSammlung'

describe('sammlungPraeferenzSchluessel', () => {
  it('baut den Präferenz-Schlüssel aus der Sammlungsart', () => {
    expect(sammlungPraeferenzSchluessel('altpapier')).toBe('sammlung_altpapier')
    expect(sammlungPraeferenzSchluessel('schrott')).toBe('sammlung_schrott')
  })
})

describe('SAMMLUNG_PRAEFERENZ_SCHLUESSEL', () => {
  it('enthält alle vier Sammlungsarten als Präferenz-Schlüssel', () => {
    expect(SAMMLUNG_PRAEFERENZ_SCHLUESSEL).toEqual([
      'sammlung_altpapier', 'sammlung_altkleider', 'sammlung_altglas', 'sammlung_schrott',
    ])
  })
})

describe('SAMMLUNG_ART_OPTIONEN / SAMMLUNG_ART_CONFIG', () => {
  it('enthält für jede Option einen passenden Konfig-Eintrag', () => {
    for (const option of SAMMLUNG_ART_OPTIONEN) {
      expect(SAMMLUNG_ART_CONFIG[option.value].label).toBe(option.label)
    }
  })
})

describe('mapSammlungPostsZuTerminen', () => {
  it('mappt einen veröffentlichten Sammlungs-Post auf einen Kalender-Termin', () => {
    const result = mapSammlungPostsZuTerminen([
      { id: 'p1', sammlung_art: 'altpapier', sammlung_datum: '2026-08-01', sammlung_organisator: 'TSV Musterdorf' },
    ])
    expect(result).toEqual([
      { id: 'p1', typ: 'sammlung_altpapier', datum: '2026-08-01', organisator: 'TSV Musterdorf' },
    ])
  })

  it('filtert Posts ohne Sammlungsart oder -datum heraus', () => {
    const result = mapSammlungPostsZuTerminen([
      { id: 'p2', sammlung_art: null, sammlung_datum: null, sammlung_organisator: null },
    ])
    expect(result).toEqual([])
  })
})

describe('getTerminAnzeigeConfig', () => {
  it('findet die Konfiguration für einen Sammlungs-Typ', () => {
    const config = getTerminAnzeigeConfig('sammlung_altglas')
    expect(config?.label).toBe('Altglassammlung')
  })

  it('findet die Konfiguration für einen regulären Abfuhr-Typ', () => {
    const config = getTerminAnzeigeConfig('biomuell')
    expect(config?.label).toBe('Biomüll')
  })

  it('gibt null für unbekannte Typen zurück', () => {
    expect(getTerminAnzeigeConfig('unbekannt')).toBeNull()
  })
})
```

- [ ] **Step 2: Test ausführen, um sicherzustellen dass er fehlschlägt**

Run: `npm run test -- abfallkalenderSammlung`

Expected: FAIL mit „Cannot find module './abfallkalenderSammlung'" (Datei existiert noch nicht).

- [ ] **Step 3: Implementierung schreiben**

```typescript
// src/lib/abfallkalenderSammlung.ts
import { ABFALL_TYP_CONFIG, type AbfallTypSchluessel, type AbfallTypInfo } from './icsParser'

// ─── Typ-Definitionen ─────────────────────────────────────────────────────────

export type SammlungArtSchluessel = 'altpapier' | 'altkleider' | 'altglas' | 'schrott'

export interface SammlungArtInfo {
  label: string
  farbe: string
  bgFarbe: string
}

// ─── Feste Optionen (fest im Code, siehe Design-Spec) ────────────────────────

export const SAMMLUNG_ART_OPTIONEN: { value: SammlungArtSchluessel; label: string }[] = [
  { value: 'altpapier', label: 'Altpapiersammlung' },
  { value: 'altkleider', label: 'Altkleidersammlung' },
  { value: 'altglas', label: 'Altglassammlung' },
  { value: 'schrott', label: 'Schrottsammlung' },
]

export const SAMMLUNG_ART_CONFIG: Record<SammlungArtSchluessel, SammlungArtInfo> = {
  altpapier:  { label: 'Altpapiersammlung',  farbe: '#0284c7', bgFarbe: 'rgba(2,132,199,0.12)' },
  altkleider: { label: 'Altkleidersammlung', farbe: '#db2777', bgFarbe: 'rgba(219,39,119,0.12)' },
  altglas:    { label: 'Altglassammlung',    farbe: '#059669', bgFarbe: 'rgba(5,150,105,0.12)' },
  schrott:    { label: 'Schrottsammlung',    farbe: '#78716c', bgFarbe: 'rgba(120,113,108,0.12)' },
}

// ─── Präferenz-Schlüssel (für abfallkalender_praeferenzen.ausgewaehlte_typen) ─

export function sammlungPraeferenzSchluessel(art: SammlungArtSchluessel): string {
  return `sammlung_${art}`
}

export const SAMMLUNG_PRAEFERENZ_SCHLUESSEL: string[] =
  SAMMLUNG_ART_OPTIONEN.map(o => sammlungPraeferenzSchluessel(o.value))

// ─── Merge-Logik: posts → Kalender-Termine ───────────────────────────────────

export interface SammlungPost {
  id: string
  sammlung_art: string | null
  sammlung_datum: string | null
  sammlung_organisator: string | null
}

export interface SammlungTermin {
  id: string
  typ: string
  datum: string
  organisator: string | null
}

export function mapSammlungPostsZuTerminen(posts: SammlungPost[]): SammlungTermin[] {
  return posts
    .filter((p): p is SammlungPost & { sammlung_art: string; sammlung_datum: string } =>
      !!p.sammlung_art && !!p.sammlung_datum)
    .map(p => ({
      id: p.id,
      typ: sammlungPraeferenzSchluessel(p.sammlung_art as SammlungArtSchluessel),
      datum: p.sammlung_datum,
      organisator: p.sammlung_organisator,
    }))
}

// ─── Einheitliche Anzeige-Konfiguration (Abfuhr-Typ ODER Sammlungsart) ───────

export function getTerminAnzeigeConfig(typ: string): AbfallTypInfo | SammlungArtInfo | null {
  if (typ in ABFALL_TYP_CONFIG) return ABFALL_TYP_CONFIG[typ as AbfallTypSchluessel]
  if (typ.startsWith('sammlung_')) {
    const art = typ.slice('sammlung_'.length) as SammlungArtSchluessel
    if (art in SAMMLUNG_ART_CONFIG) return SAMMLUNG_ART_CONFIG[art]
  }
  return null
}
```

- [ ] **Step 4: Test ausführen, um sicherzustellen dass er besteht**

Run: `npm run test -- abfallkalenderSammlung`

Expected: PASS (7 Tests grün).

- [ ] **Step 5: Commit**

```bash
git add src/lib/abfallkalenderSammlung.ts src/lib/abfallkalenderSammlung.test.ts
git commit -m "feat: Sammlung-Konfiguration und Post-zu-Termin-Mapping für Abfallkalender"
```

---

## Task 3: Zod-Schema für Vereins-Beiträge um Sammlung-Felder erweitern

**Files:**
- Modify: `src/lib/validations.ts:266-276`
- Create: `src/lib/validations.sammlung.test.ts`

- [ ] **Step 1: Failing Test schreiben**

```typescript
// src/lib/validations.sammlung.test.ts
import { describe, it, expect } from 'vitest'
import { vereinPostSchema } from './validations'

const basePayload = {
  vereinId: '11111111-1111-1111-1111-111111111111',
  titel: 'Altpapiersammlung Frühjahr',
  inhalt: 'Wir sammeln am Samstag Altpapier ein.',
}

describe('vereinPostSchema mit tag "sammlung"', () => {
  it('lehnt einen Sammlung-Beitrag ohne sammlung_art/datum/organisator ab', () => {
    const result = vereinPostSchema.safeParse({ ...basePayload, tag: 'sammlung' })
    expect(result.success).toBe(false)
  })

  it('akzeptiert einen vollständigen Sammlung-Beitrag', () => {
    const result = vereinPostSchema.safeParse({
      ...basePayload,
      tag: 'sammlung',
      sammlungArt: 'altpapier',
      sammlungDatum: '2026-08-01',
      sammlungOrganisator: 'TSV Musterdorf',
    })
    expect(result.success).toBe(true)
  })

  it('lehnt eine ungültige sammlungArt ab', () => {
    const result = vereinPostSchema.safeParse({
      ...basePayload,
      tag: 'sammlung',
      sammlungArt: 'plastik',
      sammlungDatum: '2026-08-01',
      sammlungOrganisator: 'TSV Musterdorf',
    })
    expect(result.success).toBe(false)
  })

  it('erlaubt weiterhin einen normalen Nachricht-Beitrag ohne Sammlung-Felder', () => {
    const result = vereinPostSchema.safeParse({ ...basePayload, tag: 'nachricht' })
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 2: Test ausführen, um sicherzustellen dass er fehlschlägt**

Run: `npm run test -- validations.sammlung`

Expected: FAIL — der erste Test (`lehnt ... ab`) schlägt fehl, weil `tag: 'sammlung'` heute vom bestehenden `z.enum(['nachricht', 'veranstaltung', 'bekanntmachung'])` gar nicht akzeptiert wird (Parse-Fehler aus falschem Grund) bzw. der zweite Test (vollständiger Beitrag) schlägt fehl, weil `sammlungArt` etc. noch unbekannte Schema-Felder sind.

- [ ] **Step 3: Implementierung schreiben**

```typescript
// src/lib/validations.ts — Ersetze die bestehende vereinPostSchema-Definition (Zeilen 266-276)
export const vereinPostSchema = z.object({
  vereinId: uuid,
  titel: z.string().min(1).max(200),
  inhalt: z.string().min(1).max(10000),
  tag: z.enum(['nachricht', 'veranstaltung', 'bekanntmachung', 'sammlung']).optional(),
  bildUrl: z.string().nullable().optional(),
  bilderUrls: z.array(z.string()).optional(),
  publishAt: z.string().nullable().optional(),
  veranstaltungDatum: z.string().nullable().optional(),
  veranstaltungOrt: z.string().nullable().optional(),
  sammlungArt: z.enum(['altpapier', 'altkleider', 'altglas', 'schrott']).optional(),
  sammlungDatum: z.string().optional(),
  sammlungOrganisator: z.string().min(1).max(200).optional(),
}).refine(
  data => data.tag !== 'sammlung' || (data.sammlungArt && data.sammlungDatum && data.sammlungOrganisator),
  { message: 'Sammlungsart, Datum und Organisator sind bei Kategorie "Sammlung" erforderlich', path: ['sammlungArt'] },
)
```

- [ ] **Step 4: Test ausführen, um sicherzustellen dass er besteht**

Run: `npm run test -- validations.sammlung`

Expected: PASS (4 Tests grün).

- [ ] **Step 5: Commit**

```bash
git add src/lib/validations.ts src/lib/validations.sammlung.test.ts
git commit -m "feat: Zod-Validierung für Sammlung-Beiträge (vereinPostSchema)"
```

---

## Task 4: `/api/verein/post` — Sammlung-Felder beim Erstellen persistieren

**Files:**
- Modify: `src/app/api/verein/post/route.ts:6-51`

- [ ] **Step 1: Destructuring und Insert erweitern**

```typescript
// src/app/api/verein/post/route.ts — POST-Handler, Zeilen 6-51
export const POST = withAuth(
  async (req, { profile }) => {
    const body = await req.json()
    const v = validate(vereinPostSchema, body)
    if (!v.success) return v.error

    const {
      vereinId, titel, inhalt, tag, bildUrl, bilderUrls, publishAt, veranstaltungDatum, veranstaltungOrt,
      sammlungArt, sammlungDatum, sammlungOrganisator,
    } = v.data

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
    const { data: post, error } = await service
      .from('posts')
      .insert({
        gemeinde_id: verein.gemeinde_id,
        author_id: profile.id,
        org_id: vereinId,
        channel: 'verein',
        status: 'pending',
        titel,
        inhalt,
        tag: tag ?? 'nachricht',
        bild_url: bildUrl ?? null,
        bilder_urls: bilderUrls ?? [],
        publish_at: publishAt ?? null,
        veranstaltung_datum: veranstaltungDatum ?? null,
        veranstaltung_ort: veranstaltungOrt ?? null,
        sammlung_art: tag === 'sammlung' ? sammlungArt : null,
        sammlung_datum: tag === 'sammlung' ? sammlungDatum : null,
        sammlung_organisator: tag === 'sammlung' ? sammlungOrganisator : null,
      })
      .select('id, titel, inhalt, status, created_at, tag, bild_url, publish_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ post })
  },
  { roles: ['verein', 'organisation'] },
)
```

Kein neuer Test nötig — die Geschäftslogik (welche Felder bei `tag === 'sammlung'` gesetzt werden) ist bereits über `vereinPostSchema`/`vereinPostSchema.refine` in Task 3 abgedeckt; dieser Schritt verdrahtet nur die validierten Daten in den bestehenden, ungetesteten Insert-Aufruf (wie beim bereits bestehenden `veranstaltungDatum`-Handling in derselben Funktion).

- [ ] **Step 2: Manuell verifizieren**

Mit einem eingeloggten Vereins-Test-Account (Rolle `verein`) im Browser-DevTools-Netzwerktab oder via `curl` (Cookie erforderlich) einen Sammlung-Beitrag anlegen und in Supabase prüfen:

```sql
SELECT tag, sammlung_art, sammlung_datum, sammlung_organisator, status FROM public.posts
WHERE tag = 'sammlung' ORDER BY created_at DESC LIMIT 1;
```

Erwartet: `status = 'pending'`, alle drei Sammlung-Felder befüllt.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/verein/post/route.ts
git commit -m "feat: Sammlung-Felder in /api/verein/post persistieren"
```

---

## Task 5: `VereinPostVerwaltung.tsx` — Kategorie „Sammlung" im Vereins-Formular

**Files:**
- Modify: `src/components/dashboard/VereinPostVerwaltung.tsx`

- [ ] **Step 1: Import ergänzen**

```typescript
// src/components/dashboard/VereinPostVerwaltung.tsx — nach den bestehenden Imports (nach Zeile 13)
import { SAMMLUNG_ART_OPTIONEN } from '@/lib/abfallkalenderSammlung'
```

- [ ] **Step 2: `TAGS`, `FormState`, `emptyForm` erweitern**

```typescript
// Zeile 44 ersetzen:
const TAGS = ['nachricht', 'veranstaltung', 'bekanntmachung', 'sammlung'] as const

// Zeile 46 ersetzen:
type FormState = {
  titel: string; inhalt: string; tag: string
  veranstaltung_datum: string; veranstaltung_uhrzeit: string; veranstaltung_ort: string
  sammlungArt: string; sammlungDatum: string; sammlungOrganisator: string
  geplant: boolean; scheduled_date: string; scheduled_time: string
}

// Zeile 48 ersetzen:
const emptyForm: FormState = {
  titel: '', inhalt: '', tag: 'nachricht',
  veranstaltung_datum: '', veranstaltung_uhrzeit: '', veranstaltung_ort: '',
  sammlungArt: '', sammlungDatum: '', sammlungOrganisator: '',
  geplant: false, scheduled_date: '', scheduled_time: '',
}
```

- [ ] **Step 3: `openNew()` befüllt Organisator-Vorschlag**

```typescript
// Zeile 93-98 ersetzen:
function openNew() {
  setEditingId(null)
  setForm({ ...emptyForm, sammlungOrganisator: vereinName ?? '' })
  setBildFiles([]); setBildPreviews([]); setBildrechteBestaetigt(false)
  setShowNewForm(true)
}
```

- [ ] **Step 4: `openEdit()` — neue Felder auf leer setzen (Typ-Vollständigkeit)**

`openEdit` befüllt heute kein `sammlungArt`/`sammlungDatum`/`sammlungOrganisator` (die Spalten werden beim Laden der Post-Liste in `page.tsx` gar nicht selektiert). Da `FormState` diese Felder jetzt als Pflichtfelder deklariert, muss `openEdit` sie explizit auf leer setzen, sonst schlägt der TypeScript-Build fehl:

```typescript
// Zeile 100-113 ersetzen:
function openEdit(post: Post) {
  setShowNewForm(false)
  setEditingId(post.id)
  const hasFutureSchedule = !!post.publish_at && new Date(post.publish_at) > new Date()
  setForm({
    titel: post.titel, inhalt: post.inhalt, tag: post.tag ?? 'nachricht',
    veranstaltung_datum: '', veranstaltung_uhrzeit: '', veranstaltung_ort: '',
    sammlungArt: '', sammlungDatum: '', sammlungOrganisator: '',
    geplant: hasFutureSchedule,
    scheduled_date: hasFutureSchedule ? post.publish_at!.split('T')[0] : '',
    scheduled_time: hasFutureSchedule ? (post.publish_at!.split('T')[1]?.slice(0, 5) ?? '') : '',
  })
  setBildFiles([]); setBildrechteBestaetigt(false)
  setBildPreviews(post.bild_url ? [post.bild_url] : [])
}
```

- [ ] **Step 5: `submitNew()` sendet Sammlung-Felder**

```typescript
// Innerhalb von submitNew (Zeile 146-161), body erweitern:
const res = await fetch('/api/verein/post', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    vereinId: vereinProfil.id,
    titel: form.titel,
    inhalt: form.inhalt,
    tag: form.tag,
    bildUrl,
    bilderUrls,
    publishAt,
    veranstaltungDatum: form.tag === 'veranstaltung' && form.veranstaltung_datum
      ? new Date(`${form.veranstaltung_datum}T${form.veranstaltung_uhrzeit || '00:00'}`).toISOString() : null,
    veranstaltungOrt: form.tag === 'veranstaltung' && form.veranstaltung_ort ? form.veranstaltung_ort : null,
    sammlungArt: form.tag === 'sammlung' ? form.sammlungArt : undefined,
    sammlungDatum: form.tag === 'sammlung' ? form.sammlungDatum : undefined,
    sammlungOrganisator: form.tag === 'sammlung' ? form.sammlungOrganisator : undefined,
  }),
})
```

`submitEdit()` bleibt unverändert — Sammlung-Felder werden bei Bearbeitung bestehender Beiträge bewusst nicht mitgeschickt (siehe „Wichtiger Kontext" oben).

- [ ] **Step 6: Tag-Buttons — Organisator bei Auswahl vorbefüllen**

```jsx
// Zeile 277-284 ersetzen:
<div className="flex gap-2 flex-wrap">
  {TAGS.map(tag => (
    <button key={tag} onClick={() => setForm(f => ({
      ...f,
      tag,
      sammlungOrganisator: tag === 'sammlung' && !f.sammlungOrganisator ? (vereinName ?? '') : f.sammlungOrganisator,
    }))}
      className={clsx('px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors',
        form.tag === tag ? 'border-primary-500 bg-primary-50 text-primary-600' : 'border-gray-200 text-gray-500')}>
      {tag.charAt(0).toUpperCase() + tag.slice(1)}
    </button>
  ))}
</div>
```

- [ ] **Step 7: Sammlung-Zusatzfelder rendern**

```jsx
{/* Nach dem bestehenden form.tag === 'veranstaltung'-Block (nach Zeile 323) einfügen */}
{form.tag === 'sammlung' && (
  isEditing ? (
    <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2.5">
      Sammlungsart, Datum und Organisator können nach dem Erstellen nicht mehr geändert werden.
    </p>
  ) : (
    <div className="space-y-3">
      <select value={form.sammlungArt}
        onChange={e => setForm(f => ({ ...f, sammlungArt: e.target.value }))}
        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
        <option value="">Sammlungsart wählen</option>
        {SAMMLUNG_ART_OPTIONEN.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <input type="date" value={form.sammlungDatum}
        onChange={e => setForm(f => ({ ...f, sammlungDatum: e.target.value }))}
        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
      <input type="text" placeholder="Organisation/Verein" value={form.sammlungOrganisator}
        onChange={e => setForm(f => ({ ...f, sammlungOrganisator: e.target.value }))}
        className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
    </div>
  )
)}
```

- [ ] **Step 8: Submit-Button-Sperre erweitern**

```jsx
// Zeile 349-351 ersetzen:
<button onClick={isEditing ? submitEdit : submitNew}
  disabled={loading || !form.titel || !form.inhalt || (form.geplant && !form.scheduled_date)
    || (bildFiles.length > 0 && !bildrechteBestaetigt)
    || (form.tag === 'sammlung' && !isEditing && (!form.sammlungArt || !form.sammlungDatum || !form.sammlungOrganisator))}
  className="w-full bg-primary-500 text-white font-bold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
```

- [ ] **Step 9: Manuell im Browser verifizieren**

`npm run dev` starten, mit einem Verein-Test-Account einloggen, ins Dashboard navigieren, „Neuer Beitrag" → Kategorie „Sammlung" wählen → prüfen dass Dropdown/Datum/Organisator erscheinen, Organisator mit Vereinsnamen vorbefüllt ist, und der Absenden-Button erst nach Ausfüllen aller drei Felder aktiv wird.

- [ ] **Step 10: Commit**

```bash
git add src/components/dashboard/VereinPostVerwaltung.tsx
git commit -m "feat: Kategorie Sammlung im Vereins-Beitragsformular"
```

---

## Task 6: `PostErstellenButton.tsx` — Kategorie „Sammlung" im Verwaltungs-Formular

**Files:**
- Modify: `src/components/dashboard/PostErstellenButton.tsx`

- [ ] **Step 1: Import ergänzen**

```typescript
// Nach Zeile 11
import { SAMMLUNG_ART_OPTIONEN } from '@/lib/abfallkalenderSammlung'
```

- [ ] **Step 2: `TAGS`, `TAG_LABELS`, Formular-State erweitern**

```typescript
// Zeile 13 ersetzen:
const TAGS = ['nachricht', 'veranstaltung', 'bekanntmachung', 'sammlung'] as const

// Zeile 16-19 ersetzen:
const TAG_LABELS: Record<PostTag, string> = {
  nachricht: 'Nachricht', veranstaltung: 'Veranstaltung', bekanntmachung: 'Bekanntmachung', sammlung: 'Sammlung',
  eigene_position: 'Eigene Position', fraktionsposition: 'Fraktionsposition',
}
```

```typescript
// Zeile 35 (form-State) ersetzen:
const [form, setForm] = useState({
  titel: '', inhalt: '',
  tag: (defaultChannel === 'gemeinderat' ? 'eigene_position' : 'nachricht') as PostTag,
  channel: (defaultChannel ?? 'gemeinde') as 'gemeinde' | 'verein' | 'gewerbe' | 'gemeinderat',
  veranstaltung_datum: '', veranstaltung_uhrzeit: '', veranstaltung_ort: '',
  sammlung_art: '', sammlung_datum: '', sammlung_organisator: '',
  pinned: false, push: false, geplant: false, scheduled_date: '', scheduled_time: '',
})
```

```typescript
// Zeile 60 (reset) ersetzen:
setForm({
  titel: '', inhalt: '',
  tag: defaultChannel === 'gemeinderat' ? 'eigene_position' : 'nachricht',
  channel: (defaultChannel ?? 'gemeinde') as 'gemeinde' | 'verein' | 'gewerbe' | 'gemeinderat',
  veranstaltung_datum: '', veranstaltung_uhrzeit: '', veranstaltung_ort: '',
  sammlung_art: '', sammlung_datum: '', sammlung_organisator: '',
  pinned: false, push: false, geplant: false, scheduled_date: '', scheduled_time: '',
})
```

- [ ] **Step 3: `submit()` — Sammlung-Felder ins Insert aufnehmen**

```typescript
// Zeile 90-99 ersetzen:
const { error } = await supabase.from('posts').insert({
  gemeinde_id: gemeindeId, author_id: profileId,
  channel: form.channel, titel: form.titel, inhalt: form.inhalt,
  tag: form.tag, status: 'published', pinned: form.pinned,
  bild_url, bilder_urls,
  publish_at: publishAt,
  published_at: publishAt ?? new Date().toISOString(),
  veranstaltung_datum: veranstaltungDatum,
  veranstaltung_ort: veranstaltungOrt,
  sammlung_art: form.tag === 'sammlung' ? form.sammlung_art : null,
  sammlung_datum: form.tag === 'sammlung' ? form.sammlung_datum : null,
  sammlung_organisator: form.tag === 'sammlung' ? form.sammlung_organisator : null,
}).select('id').single()
```

- [ ] **Step 4: Zusatzfelder rendern**

```jsx
{/* Nach dem bestehenden form.tag === 'veranstaltung'-Block (nach Zeile 185) einfügen */}
{form.tag === 'sammlung' && (
  <div className="space-y-3">
    <select value={form.sammlung_art}
      onChange={e => setForm(f => ({ ...f, sammlung_art: e.target.value }))}
      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
      <option value="">Sammlungsart wählen</option>
      {SAMMLUNG_ART_OPTIONEN.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
    <input type="date" value={form.sammlung_datum}
      onChange={e => setForm(f => ({ ...f, sammlung_datum: e.target.value }))}
      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
    <input type="text" placeholder="Organisation/Verein" value={form.sammlung_organisator}
      onChange={e => setForm(f => ({ ...f, sammlung_organisator: e.target.value }))}
      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
  </div>
)}
```

- [ ] **Step 5: Submit-Button-Sperre erweitern**

```jsx
// Zeile 223 ersetzen:
<button onClick={submit}
  disabled={loading || !form.titel || !form.inhalt || (form.geplant && !form.scheduled_date)
    || (bildPreviews.length > 0 && !bildrechteBestaetigt)
    || (form.tag === 'sammlung' && (!form.sammlung_art || !form.sammlung_datum || !form.sammlung_organisator))}
  className="w-full bg-primary-500 text-white font-bold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
```

- [ ] **Step 6: Manuell im Browser verifizieren**

Mit einem Verwaltungs-Test-Account einloggen, im Dashboard „Neuer Beitrag" → Kategorie „Sammlung" wählen, alle Felder ausfüllen, veröffentlichen. In Supabase prüfen, dass der Post mit `status = 'published'` und allen drei Sammlung-Feldern angelegt wurde.

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/PostErstellenButton.tsx
git commit -m "feat: Kategorie Sammlung im Verwaltungs-Beitragsformular"
```

---

## Task 7: Bürger-Kalender — Sammlungen laden, anzeigen, Filterfähig machen

**Files:**
- Modify: `src/app/(app)/abfallkalender/page.tsx`
- Modify: `src/app/(app)/abfallkalender/AbfallkalenderClient.tsx`

- [ ] **Step 1: `page.tsx` — Sammlungs-Posts zusätzlich laden und mergen**

```typescript
// src/app/(app)/abfallkalender/page.tsx — komplette Datei ersetzen
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getGemeinde } from '@/lib/gemeinde'
import { isFeatureAktiv } from '@/lib/features'
import { mapSammlungPostsZuTerminen, SAMMLUNG_PRAEFERENZ_SCHLUESSEL } from '@/lib/abfallkalenderSammlung'
import AbfallkalenderClient from './AbfallkalenderClient'

export const metadata: Metadata = { title: 'Abfallkalender – Dorfly' }

export default async function AbfallkalenderPage() {
  const gemeinde = await getGemeinde()

  if (!isFeatureAktiv(gemeinde, 'abfallkalender')) redirect('/home')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('gemeinde_id')
    .eq('id', user.id)
    .single()

  const gemeindeId = profile?.gemeinde_id

  // Termine und Nutzer-Präferenzen parallel laden
  const now = new Date()
  // 90 Tage Zeitraum (maximales Filter-Fenster)
  const start = now.toISOString().slice(0, 10)
  const end = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [termineResult, sammlungPostsResult, praeferenzenResult, einstellungenResult] = await Promise.all([
    gemeindeId
      ? supabase
          .from('abfalltermine')
          .select('id, typ, datum')
          .eq('gemeinde_id', gemeindeId)
          .gte('datum', start)
          .lte('datum', end)
          .order('datum', { ascending: true })
      : Promise.resolve({ data: [] }),
    gemeindeId
      ? supabase
          .from('posts')
          .select('id, sammlung_art, sammlung_datum, sammlung_organisator')
          .eq('gemeinde_id', gemeindeId)
          .eq('tag', 'sammlung')
          .eq('status', 'published')
          .gte('sammlung_datum', start)
          .lte('sammlung_datum', end)
      : Promise.resolve({ data: [] }),
    gemeindeId
      ? supabase
          .from('abfallkalender_praeferenzen')
          .select('ausgewaehlte_typen, push_aktiviert, email_aktiviert, benachrichtigung_uhrzeit')
          .eq('user_id', user.id)
          .eq('gemeinde_id', gemeindeId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    gemeindeId
      ? supabase
          .from('abfallkalender_einstellungen')
          .select('verfuegbare_typen')
          .eq('gemeinde_id', gemeindeId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const abfuhrTermine = (termineResult.data ?? []) as { id: string; typ: string; datum: string }[]
  const sammlungTermine = mapSammlungPostsZuTerminen(sammlungPostsResult.data ?? [])
  const termine = [...abfuhrTermine, ...sammlungTermine]

  const praeferenzen = praeferenzenResult.data
  const verfuegbareTypen = einstellungenResult.data?.verfuegbare_typen ?? []
  const alleVerfuegbarenTypen = [...verfuegbareTypen, ...SAMMLUNG_PRAEFERENZ_SCHLUESSEL]

  // Wenn keine Präferenzen: alle verfügbaren Typen (inkl. Sammlungen) vorauswählen
  const ausgewaehlteTypen: string[] = praeferenzen?.ausgewaehlte_typen ?? alleVerfuegbarenTypen

  return (
    <AbfallkalenderClient
      termine={termine}
      ausgewaehlteTypen={ausgewaehlteTypen}
      verfuegbareTypen={verfuegbareTypen}
      gemeindeName={gemeinde?.name ?? ''}
      hatPraeferenzen={praeferenzen !== null}
    />
  )
}
```

- [ ] **Step 2: `AbfallkalenderClient.tsx` — Termin-Interface, Config-Lookup, Organisator-Anzeige**

```typescript
// Zeile 9-18 ersetzen:
import { getTerminAnzeigeConfig } from '@/lib/abfallkalenderSammlung'

type Zeitraum = 7 | 30 | 90

interface Termin {
  id: string
  typ: string
  datum: string
  organisator?: string | null
}
```

```jsx
{/* Zeile 182-213 ersetzen (Abfuhr-/Sammlungs-Karten für dieses Datum) */}
{tagesTermine.map(termin => {
  const config = getTerminAnzeigeConfig(termin.typ)
  if (!config) return null

  return (
    <div
      key={termin.id}
      className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3"
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: config.bgFarbe }}
      >
        <Trash2 className="w-5 h-5" style={{ color: config.farbe }} strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 text-sm leading-snug">
          {config.label}
        </p>
        {termin.organisator && (
          <p className="text-xs text-gray-400 mt-0.5">
            organisiert von {termin.organisator}
          </p>
        )}
        {(istHeute || istMorgen) && !termin.organisator && (
          <p className="text-xs text-gray-400 mt-0.5">
            Tonne bis 06:00 Uhr bereitstellen
          </p>
        )}
      </div>
      <div
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ background: config.farbe }}
      />
    </div>
  )
})}
```

- [ ] **Step 3: Manuell verifizieren**

`npm run dev`, mit einem Bürger-Test-Account einloggen, einen zuvor angelegten (veröffentlichten) Sammlungs-Beitrag im Zeitraum prüfen: er muss unter `/abfallkalender` an seinem Datum erscheinen, mit korrektem Label/Icon und „organisiert von …"-Zeile.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/abfallkalender/page.tsx" "src/app/(app)/abfallkalender/AbfallkalenderClient.tsx"
git commit -m "feat: Sammlungstermine im Bürger-Abfallkalender anzeigen"
```

---

## Task 8: Einstellungen-Seite — Sammlungsarten als Präferenz auswählbar machen

**Files:**
- Modify: `src/app/(app)/abfallkalender/einstellungen/page.tsx`
- Modify: `src/app/(app)/abfallkalender/einstellungen/AbfallEinstellungenClient.tsx`

- [ ] **Step 1: `page.tsx` — Default-Auswahl inkl. Sammlungsarten**

```typescript
// src/app/(app)/abfallkalender/einstellungen/page.tsx — komplette Datei ersetzen
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getGemeinde } from '@/lib/gemeinde'
import { isFeatureAktiv } from '@/lib/features'
import { SAMMLUNG_PRAEFERENZ_SCHLUESSEL } from '@/lib/abfallkalenderSammlung'
import AbfallEinstellungenClient from './AbfallEinstellungenClient'

export default async function AbfallEinstellungenPage() {
  const gemeinde = await getGemeinde()

  if (!isFeatureAktiv(gemeinde, 'abfallkalender')) redirect('/home')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('gemeinde_id')
    .eq('id', user.id)
    .single()

  const gemeindeId = profile?.gemeinde_id

  const [praeferenzenResult, einstellungenResult] = await Promise.all([
    gemeindeId
      ? supabase
          .from('abfallkalender_praeferenzen')
          .select('*')
          .eq('user_id', user.id)
          .eq('gemeinde_id', gemeindeId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    gemeindeId
      ? supabase
          .from('abfallkalender_einstellungen')
          .select('verfuegbare_typen')
          .eq('gemeinde_id', gemeindeId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const praeferenzen = praeferenzenResult.data
  const verfuegbareTypen = einstellungenResult.data?.verfuegbare_typen ?? []
  const alleVerfuegbarenTypen = [...verfuegbareTypen, ...SAMMLUNG_PRAEFERENZ_SCHLUESSEL]

  return (
    <AbfallEinstellungenClient
      gemeindeName={gemeinde?.name ?? ''}
      verfuegbareTypen={verfuegbareTypen}
      initialAusgewaehlt={praeferenzen?.ausgewaehlte_typen ?? alleVerfuegbarenTypen}
      initialPush={praeferenzen?.push_aktiviert ?? false}
      initialEmail={praeferenzen?.email_aktiviert ?? false}
    />
  )
}
```

- [ ] **Step 2: `AbfallEinstellungenClient.tsx` — neue Sammlungen-Sektion**

```typescript
// Import ergänzen (nach Zeile 9)
import { SAMMLUNG_ART_OPTIONEN, SAMMLUNG_ART_CONFIG, sammlungPraeferenzSchluessel } from '@/lib/abfallkalenderSammlung'
```

```jsx
{/* Nach der bestehenden "Abfallarten"-Section (nach Zeile 124), vor "Benachrichtigungen" einfügen */}
<section className="bg-white rounded-2xl shadow-sm p-5">
  <h2 className="font-black text-gray-900 text-sm uppercase tracking-wide mb-4">
    Sammlungen
  </h2>
  <div className="space-y-2">
    {SAMMLUNG_ART_OPTIONEN.map(option => {
      const schluessel = sammlungPraeferenzSchluessel(option.value)
      const config = SAMMLUNG_ART_CONFIG[option.value]
      const aktiv = ausgewaehlt.includes(schluessel)

      return (
        <button
          key={schluessel}
          onClick={() => toggleTyp(schluessel)}
          className={clsx(
            'w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left',
            aktiv ? 'bg-gray-50 ring-1 ring-gray-200' : 'bg-gray-50/50 opacity-60',
          )}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: config.bgFarbe }}
          >
            <Trash2 className="w-4 h-4" style={{ color: config.farbe }} strokeWidth={1.5} />
          </div>
          <span className="flex-1 font-semibold text-gray-800 text-sm">{config.label}</span>
          <div
            className={clsx(
              'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
              aktiv ? 'border-primary-500 bg-primary-500' : 'border-gray-300',
            )}
          >
            {aktiv && <CheckCircle className="w-3 h-3 text-white" />}
          </div>
        </button>
      )
    })}
  </div>
</section>
```

- [ ] **Step 3: Manuell verifizieren**

`/abfallkalender/einstellungen` öffnen: neue Sektion „Sammlungen" mit 4 Checkboxen muss erscheinen, Toggle-Verhalten identisch zur bestehenden „Abfallarten"-Sektion, Speichern-Button funktioniert unverändert (keine Schema-Änderung an `abfallPraeferenzenSchluessel` nötig, da `ausgewaehlteTypen` bereits als `z.array(z.string())` beliebige Strings akzeptiert).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/abfallkalender/einstellungen/page.tsx" "src/app/(app)/abfallkalender/einstellungen/AbfallEinstellungenClient.tsx"
git commit -m "feat: Sammlungsarten als Filter-Präferenz in Abfallkalender-Einstellungen"
```

---

## Task 9: Cron-Job — Sammlungstermine in Push-/E-Mail-Erinnerungen aufnehmen

**Files:**
- Modify: `src/app/api/cron/abfall-benachrichtigungen/route.ts`

- [ ] **Step 1: Komplette Datei ersetzen**

```typescript
// src/app/api/cron/abfall-benachrichtigungen/route.ts
/**
 * Täglicher Cronjob: Abfallkalender-Benachrichtigungen
 *
 * Sendet Push-Notifications und E-Mails an Nutzer, die morgen eine Abfuhr
 * oder eine abonnierte Sammlung (Altpapier/Altkleider/Altglas/Schrott) haben.
 * Wird per Vercel Cron täglich um 18:00 Uhr MEZ aufgerufen (vercel.json).
 *
 * Hinweis: Die individuelle notificationTime je Nutzer wird gespeichert, aber da
 * der Cron einmal täglich feuert, richtet sich der Versandzeitpunkt nach der
 * Cron-Einstellung. Für per-Nutzer-Zeitsteuerung wäre eine Queue-Lösung nötig.
 *
 * Gesichert über CRON_SECRET Environment-Variable.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { ABFALL_TYP_CONFIG } from '@/lib/icsParser'
import type { AbfallTypSchluessel } from '@/lib/icsParser'
import { SAMMLUNG_ART_CONFIG, sammlungPraeferenzSchluessel } from '@/lib/abfallkalenderSammlung'
import type { SammlungArtSchluessel } from '@/lib/abfallkalenderSammlung'
import { Resend } from 'resend'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = await createServiceClient()

  // Morgen-Datum berechnen
  const morgen = new Date()
  morgen.setDate(morgen.getDate() + 1)
  const morgenStr = morgen.toISOString().slice(0, 10) // 'YYYY-MM-DD'

  // Alle Nutzer mit aktivierten Präferenzen laden
  const { data: praeferenzen, error: praeferenzenError } = await service
    .from('abfallkalender_praeferenzen')
    .select('user_id, gemeinde_id, ausgewaehlte_typen, push_aktiviert, email_aktiviert')

  if (praeferenzenError || !praeferenzen) {
    console.error('[Abfallkalender Cron] Fehler beim Laden der Präferenzen:', praeferenzenError)
    return NextResponse.json({ error: 'Fehler beim Laden der Präferenzen' }, { status: 500 })
  }

  // Alle morgen anfallenden Termine laden (einmalig, dann per Code filtern)
  const [{ data: morgenTermine }, { data: morgenSammlungen }] = await Promise.all([
    service.from('abfalltermine').select('gemeinde_id, typ').eq('datum', morgenStr),
    service
      .from('posts')
      .select('gemeinde_id, sammlung_art, sammlung_organisator')
      .eq('tag', 'sammlung')
      .eq('status', 'published')
      .eq('sammlung_datum', morgenStr),
  ])

  if ((!morgenTermine || morgenTermine.length === 0) && (!morgenSammlungen || morgenSammlungen.length === 0)) {
    return NextResponse.json({ ok: true, versendet: 0, nachricht: 'Keine Termine morgen' })
  }

  // Gemeinde → Termintypen-Map aufbauen
  const termineByGemeinde = new Map<string, string[]>()
  for (const t of morgenTermine ?? []) {
    const existing = termineByGemeinde.get(t.gemeinde_id) ?? []
    termineByGemeinde.set(t.gemeinde_id, [...existing, t.typ])
  }

  // Gemeinde → Sammlungen-Map aufbauen (Art + Organisator, mehrere pro Gemeinde möglich)
  const sammlungenByGemeinde = new Map<string, { art: SammlungArtSchluessel; organisator: string }[]>()
  for (const s of morgenSammlungen ?? []) {
    if (!s.sammlung_art) continue
    const existing = sammlungenByGemeinde.get(s.gemeinde_id) ?? []
    existing.push({ art: s.sammlung_art as SammlungArtSchluessel, organisator: s.sammlung_organisator ?? 'unbekannt' })
    sammlungenByGemeinde.set(s.gemeinde_id, existing)
  }

  // Gemeinde-Slugs für korrekte Notification-URLs laden
  const gemeindeIds = [...new Set(praeferenzen.map(p => p.gemeinde_id))]
  const { data: gemeinden } = await service
    .from('gemeinden')
    .select('id, slug')
    .in('id', gemeindeIds)
  const slugByGemeinde = new Map((gemeinden ?? []).map(g => [g.id, g.slug]))

  const userIds = praeferenzen.map(p => p.user_id)
  const { data: profiles } = await service
    .from('profiles')
    .select('id, display_name, email')
    .in('id', userIds)

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))

  let versendet = 0
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

  for (const pref of praeferenzen) {
    const termineGemeinde = termineByGemeinde.get(pref.gemeinde_id) ?? []
    const sammlungenGemeinde = sammlungenByGemeinde.get(pref.gemeinde_id) ?? []

    const ausgewaehlteTypen = pref.ausgewaehlte_typen as string[]

    // Schnittmenge: Welche der ausgewählten Abfuhr-Typen werden morgen abgeholt?
    const betroffeneTypen = ausgewaehlteTypen.filter(t => termineGemeinde.includes(t))
    // Schnittmenge: Welche der ausgewählten Sammlungsarten finden morgen statt?
    const betroffeneSammlungen = sammlungenGemeinde.filter(s =>
      ausgewaehlteTypen.includes(sammlungPraeferenzSchluessel(s.art)),
    )

    if (betroffeneTypen.length === 0 && betroffeneSammlungen.length === 0) continue

    const abfuhrZeilen = betroffeneTypen.map(
      t => `${ABFALL_TYP_CONFIG[t as AbfallTypSchluessel]?.label ?? t} wird abgeholt`,
    )
    const sammlungZeilen = betroffeneSammlungen.map(
      s => `${SAMMLUNG_ART_CONFIG[s.art].label} (organisiert von ${s.organisator})`,
    )
    const alleZeilen = [...abfuhrZeilen, ...sammlungZeilen]

    // ── Push-Notification ────────────────────────────────────────────────────
    const gemeindeSlug = slugByGemeinde.get(pref.gemeinde_id) ?? ''
    if (pref.push_aktiviert) {
      for (const typ of betroffeneTypen) {
        const label = ABFALL_TYP_CONFIG[typ as AbfallTypSchluessel]?.label ?? typ
        await sendPush(pref.user_id, `Morgen wird ${label} abgeholt. Tonne bitte bis 06:00 Uhr bereitstellen.`, gemeindeSlug)
      }
      for (const s of betroffeneSammlungen) {
        const label = SAMMLUNG_ART_CONFIG[s.art].label
        await sendPush(pref.user_id, `Morgen findet die ${label} statt (organisiert von ${s.organisator}).`, gemeindeSlug)
      }
    }

    // ── E-Mail ───────────────────────────────────────────────────────────────
    if (pref.email_aktiviert && resend) {
      const email = profileMap.get(pref.user_id)?.email
      const displayName = profileMap.get(pref.user_id)?.display_name ?? 'Hallo'
      if (email) {
        await sendEmail(resend, email, displayName, alleZeilen)
      }
    }

    versendet++
  }

  return NextResponse.json({ ok: true, versendet, morgen: morgenStr })
}

// ─── Push über OneSignal (einzelner Nutzer via external_id) ──────────────────

async function sendPush(userId: string, nachricht: string, gemeindeSlug: string) {
  await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${process.env.ONESIGNAL_REST_API_KEY}`,
    },
    body: JSON.stringify({
      app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
      include_aliases: { external_id: [userId] },
      target_channel: 'push',
      headings: { de: 'Abfuhr-Erinnerung', en: 'Abfuhr-Erinnerung' },
      contents: { de: nachricht, en: nachricht },
      web_url: `https://${gemeindeSlug}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'dorfly.de'}/abfallkalender`,
      data: { pfad: '/abfallkalender' },
    }),
  }).catch(e => console.error('[Abfallkalender Cron] Push-Fehler:', e))
}

// ─── E-Mail über Resend ───────────────────────────────────────────────────────

async function sendEmail(resend: Resend, email: string, name: string, zeilen: string[]) {
  const zeilenHtml = zeilen
    .map(z => `<li><strong>${z}</strong></li>`)
    .join('')

  await resend.emails
    .send({
      from: `Dorfly <noreply@${process.env.RESEND_FROM_DOMAIN ?? 'dorfly.de'}>`,
      to: [email],
      subject: `Abfuhr-Erinnerung: morgen wird abgeholt`,
      html: `
        <p>Hallo ${name},</p>
        <p>morgen stehen folgende Termine an:</p>
        <ul>${zeilenHtml}</ul>
        <p>Bitte stelle deine Tonne(n) bis <strong>06:00 Uhr</strong> bereit, falls eine Abfuhr dabei ist.</p>
        <p>Dein Dorfly-Team</p>
      `,
    })
    .catch(e => console.error('[Abfallkalender Cron] E-Mail-Fehler:', e))
}
```

- [ ] **Step 2: Manuell verifizieren**

Mit gültigem `CRON_SECRET` lokal aufrufen:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/abfall-benachrichtigungen
```

Erwartet: `{"ok":true,"versendet":<n>,"morgen":"<Datum>"}`. Mit einem Test-Nutzer, der eine Sammlungsart für morgen abonniert hat (`push_aktiviert: true`), in den Server-Logs bzw. via OneSignal-Dashboard prüfen, dass eine Push mit dem Sammlungs-Text gesendet wurde.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/abfall-benachrichtigungen/route.ts
git commit -m "feat: Sammlungstermine in Abfallkalender-Erinnerungen (Push/E-Mail) aufnehmen"
```

---

## Task 10: Gesamte Test-Suite und Typprüfung

**Files:** keine (Verifikations-Task)

- [ ] **Step 1: Vollständige Test-Suite ausführen**

Run: `npm run test`

Expected: Alle Tests grün, inklusive der neuen Dateien aus Task 2 und 3.

- [ ] **Step 2: Production-Build ausführen (TypeScript-Fehler abfangen)**

Run: `npm run build`

Expected: Build erfolgreich, keine TypeScript-Fehler (insbesondere in `PostErstellenButton.tsx`, `VereinPostVerwaltung.tsx`, `AbfallkalenderClient.tsx`, `abfall-benachrichtigungen/route.ts`).

- [ ] **Step 3: Falls Fehler auftreten**

Fehler beheben, betroffene Datei erneut committen (kein `--amend`, neuer Commit mit Fix).

---

## Self-Review-Notizen (bereits eingearbeitet)

- **Spec-Abdeckung geprüft:** Datenmodell (Task 1), Verwaltungs-Flow (Task 6), Vereins-Flow (Task 3-5), Bürger-Kalender/Filter (Task 7-8), Benachrichtigungen (Task 9), Feed-Darstellung (kein Task nötig, siehe Spec Abschnitt F). „Nicht im Scope"-Punkte werden nirgends versehentlich implementiert (kein Uhrzeit-Feld, keine Organisator-Filterung, Sammlungsarten fest im Code, kein Gewerbe-Zugriff, kein Feed-Badge).
- **Korrektur gegenüber ursprünglicher Spec:** Ziel-Komponente für den Vereins-Flow ist `VereinPostVerwaltung.tsx`, nicht `VereinPostForm.tsx` (totes Code) — in der Spec und in diesem Plan bereits korrigiert.
- **Typkonsistenz:** `sammlungPraeferenzSchluessel`, `SAMMLUNG_ART_CONFIG`, `mapSammlungPostsZuTerminen`, `getTerminAnzeigeConfig` werden in Task 2 definiert und in Task 7, 8, 9 mit identischer Signatur importiert und verwendet.
- **CHECK-Constraint-Sicherheit:** `vereinPostUpdateSchema`/`/api/posts/update` bleiben absichtlich unverändert, damit kein Edit-Pfad die Sammlung-Spalten auf `NULL` setzen und damit den Constraint verletzen kann (siehe „Wichtiger Kontext" oben).
