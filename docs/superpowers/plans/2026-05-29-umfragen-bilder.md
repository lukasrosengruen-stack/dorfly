# Plan: Bildupload für Umfragen

**Spec:** `docs/superpowers/specs/2026-05-29-umfragen-bilder-design.md`  
**Ansatz:** Sofort-Upload (Approach A) — Bilder werden direkt beim Auswählen hochgeladen

---

## Phase 0: Documentation Discovery (abgeschlossen)

**Relevante Dateien und Signaturen:**

| Was | Wo | Detail |
|---|---|---|
| BilderUpload-Komponente | `src/components/dashboard/BilderUpload.tsx` | Props: `{ previews: string[], onAdd: (files: File[]) => void, onRemove: (index: number) => void, id: string }` — reine UI, kein Upload-Logic |
| compressImage | `src/lib/compressImage.ts` | `async function compressImage(file: File): Promise<File>` |
| Upload-Pattern | `src/features/gewerbe/GewerbePostForm.tsx:30-46` | compress → `supabase.storage.from('dorfly-media').upload(path, file)` → `getPublicUrl(path)` mit Browser-Client |
| UmfrageErstellen | `src/components/umfrage/UmfrageErstellen.tsx` | `FormFrage` Interface Zeilen 16-21; `beschreibung`-Feld Zeile 143; Fragen-Loop Zeile 163 |
| UmfrageBearbeiten | `src/components/umfrage/UmfrageBearbeiten.tsx` | Props Zeilen 20-24 (erhält vollständiges `Umfrage`-Objekt inkl. `umfrage_fragen`); `beschreibung` Zeilen 93-112 |
| UmfrageCard | `src/components/umfrage/UmfrageCard.tsx` | `beschreibung` Zeile 122; Fragen-Loop Zeile 138 |
| Validierungsschemas | `src/lib/validations.ts` | `umfrageErstellenSchema` Zeilen 151-173; `umfrageBearbeitenSchema` Zeilen 179-184 |
| API Erstellen | `src/app/api/umfragen/erstellen/route.ts` | umfragen-Insert Zeilen 16-24; umfrage_fragen-Insert Zeilen 28-36 |
| API Bearbeiten | `src/app/api/umfragen/bearbeiten/route.ts` | umfragen-UPDATE Zeilen 19-23 |
| Letzte Migration | `supabase/migrations/033_posts_drop_org_fk.sql` | Nächste Nummer: **034** |

**Upload-Pfade (laut Design-Spec):**
- Erstellen: `umfragen/tmp/{userId}/{timestamp}_{filename}`
- Bearbeiten: `umfragen/{umfrageId}/{timestamp}_{filename}`

---

## Phase 1: Datenbankschema

**Aufgabe:** Migration 034 erstellen, anwenden, TypeScript-Typen regenerieren.

### Schritt 1.1 — Migration erstellen

Neue Datei: `supabase/migrations/034_umfragen_bilder.sql`

```sql
-- Bilder-URLs für Umfragen (Header) und einzelne Fragen (illustrierend)
ALTER TABLE public.umfragen
  ADD COLUMN IF NOT EXISTS bilder_urls text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.umfrage_fragen
  ADD COLUMN IF NOT EXISTS bilder_urls text[] NOT NULL DEFAULT '{}';
```

Keine neuen GRANTs nötig — Spalten erben die bestehenden Grants aus `012_explicit_grants.sql`.

### Schritt 1.2 — Migration anwenden

```bash
# Über Supabase CLI (falls lokal):
supabase db push

# Oder Migration manuell im Supabase Dashboard unter SQL Editor ausführen.
```

### Schritt 1.3 — TypeScript-Typen regenerieren

```bash
npm run db:types
```

**Verifikation:**
- `src/types/supabase.ts` enthält `bilder_urls: string[]` in den `umfragen`- und `umfrage_fragen`-Row-Typen
- Grep: `grep -n "bilder_urls" src/types/supabase.ts` → muss in beiden Tabellen auftauchen

---

## Phase 2: Validierungsschemas & API — Erstellen

**Aufgabe:** Zod-Schemas und API-Route für Umfrageerstellung um `bilder_urls` erweitern.

### Schritt 2.1 — `umfrageErstellenSchema` erweitern

Datei: `src/lib/validations.ts`, Zeilen 151-173

`bilder_urls` auf Umfrage-Ebene (nach `gemeindeId`):
```typescript
bilder_urls: z.array(z.string().url()).optional().default([]),
```

`bilder_urls` pro Frage (im `fragen`-Array-Objekt, nach `typ`):
```typescript
bilder_urls: z.array(z.string().url()).optional().default([]),
```

### Schritt 2.2 — API-Route Erstellen anpassen

Datei: `src/app/api/umfragen/erstellen/route.ts`

Destukturierung am Anfang der Route um `bilder_urls` erweitern:
```typescript
const { titel, beschreibung, enddatum, gemeindeId, fragen, bilder_urls } = body
```

umfragen-Insert (Zeile ~18) um `bilder_urls` ergänzen:
```typescript
.insert({ titel, beschreibung: beschreibung ?? null, enddatum, gemeinde_id: gemeindeId, author_id: user.id, bilder_urls: bilder_urls ?? [] })
```

umfrage_fragen-Insert (Zeile ~31) um `bilder_urls` ergänzen:
```typescript
.insert({ umfrage_id: umfrage.id, reihenfolge: frage.reihenfolge, frage_text: frage.frage_text, typ: frage.typ, bilder_urls: frage.bilder_urls ?? [] })
```

**Verifikation:**
- `npm run build` — keine TypeScript-Fehler
- Optional: Postman/curl POST gegen `/api/umfragen/erstellen` mit `bilder_urls: ["https://..."]` und je einer Frage mit `bilder_urls`

---

## Phase 3: Validierungsschemas & API — Bearbeiten

**Aufgabe:** Bearbeiten-Route um Umfrage-Bilder und separaten Fragen-Bilder-Update-Pfad erweitern (ohne Delete+Recreate der Fragen, um Abstimmungsdaten zu erhalten).

### Schritt 3.1 — `umfrageBearbeitenSchema` erweitern

Datei: `src/lib/validations.ts`, Zeilen 179-184

```typescript
export const umfrageBearbeitenSchema = z.object({
  id: uuid,
  titel: nonEmpty.max(200),
  beschreibung: z.string().max(1000).nullable().optional(),
  enddatum: z.string().min(1, 'Enddatum erforderlich'),
  bilder_urls: z.array(z.string().url()).optional().default([]),
  fragen_bilder: z.array(z.object({
    id: z.string().uuid(),
    bilder_urls: z.array(z.string().url()),
  })).optional(),
})
```

### Schritt 3.2 — API-Route Bearbeiten anpassen

Datei: `src/app/api/umfragen/bearbeiten/route.ts`

Destrukturierung am Anfang um `bilder_urls` und `fragen_bilder` erweitern:
```typescript
const { id: umfrageId, titel, beschreibung, enddatum, bilder_urls, fragen_bilder } = body
```

umfragen-UPDATE (Zeile ~21) um `bilder_urls` ergänzen:
```typescript
.update({ titel, beschreibung: beschreibung ?? null, enddatum, bilder_urls: bilder_urls ?? [] })
```

Neuen Block nach dem bestehenden UPDATE einfügen (vor dem optionalen `fragen`-Block):
```typescript
// Fragen-Bilder per UPDATE (kein Delete+Insert — Abstimmungsdaten bleiben erhalten)
if (fragen_bilder?.length) {
  for (const { id, bilder_urls: urls } of fragen_bilder) {
    await service
      .from('umfrage_fragen')
      .update({ bilder_urls: urls })
      .eq('id', id)
      .eq('umfrage_id', umfrageId)  // Sicherheitscheck: Frage gehört zur Umfrage
  }
}
```

**Verifikation:**
- `npm run build` — keine TypeScript-Fehler
- Grep: `grep -n "fragen_bilder" src/app/api/umfragen/bearbeiten/route.ts` → muss vorkommen

---

## Phase 4: UmfrageErstellen — Bildupload UI

**Aufgabe:** `BilderUpload` für Umfrage-Header und je Frage in `UmfrageErstellen.tsx` integrieren.

### Schritt 4.1 — FormFrage-Interface erweitern

Datei: `src/components/umfrage/UmfrageErstellen.tsx`, Zeilen 16-21

`bilder_urls: string[]` zu `FormFrage` hinzufügen:
```typescript
interface FormFrage {
  tempId: string
  frage_text: string
  typ: FrageTyp
  optionen: string[]
  bilder_urls: string[]   // NEU
}
```

### Schritt 4.2 — State initialisieren

`initialFrage`-Factory (oder wo neue Fragen erstellt werden) um `bilder_urls: []` erweitern.

Neue State-Variablen für Umfrage-Ebene und Loading-State hinzufügen:
```typescript
const [umfrageBilder, setUmfrageBilder] = useState<string[]>([])
const [bilderLoading, setBilderLoading] = useState(false)
```

### Schritt 4.3 — Upload-Handler für Umfrage-Bilder

```typescript
async function handleUmfrageBilderAdd(files: File[]) {
  setBilderLoading(true)
  try {
    const supabase = createClient()
    const newUrls: string[] = []
    for (const file of files) {
      const compressed = await compressImage(file)
      const path = `umfragen/tmp/${userId}/${Date.now()}_${compressed.name}`
      const { error } = await supabase.storage.from('dorfly-media').upload(path, compressed)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('dorfly-media').getPublicUrl(path)
      newUrls.push(publicUrl)
    }
    setUmfrageBilder(prev => [...prev, ...newUrls])
  } catch {
    toast.error('Bild-Upload fehlgeschlagen')
  } finally {
    setBilderLoading(false)
  }
}

function handleUmfrageBilderRemove(index: number) {
  setUmfrageBilder(prev => prev.filter((_, i) => i !== index))
}
```

### Schritt 4.4 — Upload-Handler für Fragen-Bilder

```typescript
async function handleFrageBilderAdd(tempId: string, files: File[]) {
  try {
    const supabase = createClient()
    const newUrls: string[] = []
    for (const file of files) {
      const compressed = await compressImage(file)
      const path = `umfragen/tmp/${userId}/${Date.now()}_${compressed.name}`
      const { error } = await supabase.storage.from('dorfly-media').upload(path, compressed)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('dorfly-media').getPublicUrl(path)
      newUrls.push(publicUrl)
    }
    setFragen(prev => prev.map(f =>
      f.tempId === tempId ? { ...f, bilder_urls: [...f.bilder_urls, ...newUrls] } : f
    ))
  } catch {
    toast.error('Bild-Upload fehlgeschlagen')
  }
}

function handleFrageBilderRemove(tempId: string, index: number) {
  setFragen(prev => prev.map(f =>
    f.tempId === tempId ? { ...f, bilder_urls: f.bilder_urls.filter((_, i) => i !== index) } : f
  ))
}
```

### Schritt 4.5 — BilderUpload nach beschreibung einbinden (Zeile ~148)

Nach dem `RichTextEditor` für `beschreibung`:
```tsx
<BilderUpload
  id="umfrage-bilder"
  previews={umfrageBilder}
  onAdd={handleUmfrageBilderAdd}
  onRemove={handleUmfrageBilderRemove}
/>
```

### Schritt 4.6 — BilderUpload pro Fragencard (Zeile ~163, im fragen.map-Loop)

Am Ende jeder Fragencard (nach dem bestehenden Optionen-Block):
```tsx
<BilderUpload
  id={`frage-bilder-${frage.tempId}`}
  previews={frage.bilder_urls}
  onAdd={(files) => handleFrageBilderAdd(frage.tempId, files)}
  onRemove={(idx) => handleFrageBilderRemove(frage.tempId, idx)}
/>
```

### Schritt 4.7 — Submit-Handler anpassen

Im API-Request `bilder_urls: umfrageBilder` auf Umfrage-Ebene und pro Frage `bilder_urls: frage.bilder_urls` mitschicken.

**Verifikation:**
- `npm run build` — keine TypeScript-Fehler
- Manuell: Umfrage erstellen, Bilder hochladen, absenden → in DB prüfen ob `bilder_urls` korrekt gesetzt

---

## Phase 5: UmfrageBearbeiten — Bildupload UI

**Aufgabe:** `BilderUpload` für Umfrage-Header und Fragen-Bilder in `UmfrageBearbeiten.tsx` integrieren. Vorhandene URLs vorbelegen.

### Schritt 5.1 — Lokale State für Bilder initialisieren

Datei: `src/components/umfrage/UmfrageBearbeiten.tsx`

```typescript
const [umfrageBilder, setUmfrageBilder] = useState<string[]>(umfrage.bilder_urls ?? [])
const [fragenBilder, setFragenBilder] = useState<Record<string, string[]>>(
  Object.fromEntries(
    (umfrage.umfrage_fragen ?? []).map(f => [f.id, f.bilder_urls ?? []])
  )
)
```

### Schritt 5.2 — Upload-Handler für Umfrage-Bilder

Gleicher Upload-Handler wie in Phase 4.3, aber mit Pfad `umfragen/${umfrage.id}/${Date.now()}_...`:
```typescript
async function handleUmfrageBilderAdd(files: File[]) { ... }
function handleUmfrageBilderRemove(index: number) { ... }
```

### Schritt 5.3 — Upload-Handler für Fragen-Bilder

```typescript
async function handleFrageBilderAdd(frageId: string, files: File[]) {
  // compress → upload zu umfragen/{umfrage.id}/{timestamp}_... → publicUrl
  // setFragenBilder(prev => ({ ...prev, [frageId]: [...(prev[frageId] ?? []), ...newUrls] }))
}
function handleFrageBilderRemove(frageId: string, index: number) {
  setFragenBilder(prev => ({
    ...prev,
    [frageId]: (prev[frageId] ?? []).filter((_, i) => i !== index)
  }))
}
```

### Schritt 5.4 — BilderUpload nach beschreibung einbinden (Zeile ~112)

Nach dem `RichTextEditor` für `beschreibung`:
```tsx
<BilderUpload
  id="umfrage-bearbeiten-bilder"
  previews={umfrageBilder}
  onAdd={handleUmfrageBilderAdd}
  onRemove={handleUmfrageBilderRemove}
/>
```

### Schritt 5.5 — Fragen-Sektion hinzufügen

Nach dem BilderUpload (vor dem Speichern-Button), wenn `umfrage.umfrage_fragen?.length`:
```tsx
{(umfrage.umfrage_fragen ?? []).sort((a, b) => a.reihenfolge - b.reihenfolge).map(frage => (
  <div key={frage.id} className="border border-gray-200 rounded-xl p-4 space-y-2">
    <p className="text-sm font-medium text-gray-700">{frage.frage_text}</p>
    <BilderUpload
      id={`frage-bearbeiten-bilder-${frage.id}`}
      previews={fragenBilder[frage.id] ?? []}
      onAdd={(files) => handleFrageBilderAdd(frage.id, files)}
      onRemove={(idx) => handleFrageBilderRemove(frage.id, idx)}
    />
  </div>
))}
```

### Schritt 5.6 — onSubmit anpassen

Im API-Request mitschicken:
```typescript
bilder_urls: umfrageBilder,
fragen_bilder: Object.entries(fragenBilder).map(([id, bilder_urls]) => ({ id, bilder_urls })),
```

**Verifikation:**
- Vorhandene Bilder werden beim Öffnen des Dialogs angezeigt
- Neue Bilder können hinzugefügt und entfernt werden
- Nach Speichern sind die Bilder korrekt in der DB

---

## Phase 6: UmfrageCard — Bilder anzeigen

**Aufgabe:** Hochgeladene Bilder in der Bürger-Ansicht anzeigen.

### Schritt 6.1 — Umfrage-Bilder nach beschreibung (Zeile ~122)

Datei: `src/components/umfrage/UmfrageCard.tsx`

Nach der `beschreibung`-Zeile (~122), wenn `umfrage.bilder_urls?.length`:
```tsx
{(umfrage.bilder_urls ?? []).length > 0 && (
  <div
    className="flex gap-2 overflow-x-auto py-1"
    role="list"
    aria-label="Umfragebilder"
  >
    {umfrage.bilder_urls!.map((url, i) => (
      <div key={i} role="listitem" className="shrink-0">
        <img
          src={url}
          alt=""
          className="h-40 w-auto rounded-lg object-cover"
        />
      </div>
    ))}
  </div>
)}
```

### Schritt 6.2 — Fragen-Bilder über Abstimmung (Zeile ~138, im Fragen-Loop)

In der `fragen.map()`-Schleife, vor `<Abstimmung>`:
```tsx
{(frage.bilder_urls ?? []).length > 0 && (
  <div
    className="flex gap-2 overflow-x-auto py-1"
    role="list"
    aria-label="Fragebilder"
  >
    {frage.bilder_urls!.map((url, i) => (
      <div key={i} role="listitem" className="shrink-0">
        <img
          src={url}
          alt=""
          className="h-32 w-auto rounded-lg object-cover"
        />
      </div>
    ))}
  </div>
)}
```

**Verifikation:**
- Bilder erscheinen korrekt in der Umfragen-Ansicht
- Bilder sind als `alt=""` (dekorativ) markiert
- Galerie ist horizontal scrollbar wenn mehrere Bilder vorhanden

---

## Phase 7: Abschlussverifikation

```bash
npm run test     # alle Vitest-Tests müssen grün sein
npm run build    # TypeScript + Build ohne Fehler
```

**Manuelle Checkliste:**
- [ ] Umfrage mit Bilder erstellen → Bilder in DB (`bilder_urls`) und in der Bürger-Ansicht sichtbar
- [ ] Frage mit Bild erstellen → Bild erscheint in der Abstimmungs-Ansicht über den Optionen
- [ ] Umfrage bearbeiten → bestehende Bilder werden vorbeladen angezeigt
- [ ] Bild in Bearbeiten entfernen → nach Speichern ist Bild weg, Abstimmungsdaten erhalten
- [ ] Neues Bild in Bearbeiten hinzufügen → nach Speichern erscheint das neue Bild
- [ ] `umfrage_antworten`-Count vor und nach Bildbearbeitung ist identisch (kein Datenverlust)
