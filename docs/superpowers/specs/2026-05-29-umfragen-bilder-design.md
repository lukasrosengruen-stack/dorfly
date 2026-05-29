# Design: Bildupload für Umfragen

**Datum:** 2026-05-29  
**Status:** Genehmigt  
**Scope:** Mehrere Bilder pro Umfrage (Header) und pro einzelner Frage; nur für Ersteller; illustrierend; editierbar in Erstell- und Bearbeiten-Dialog.

---

## Anforderungen

- Ersteller (Rollen: `verwaltung`, `super_admin`) können beim Erstellen und Bearbeiten einer Umfrage **mehrere Bilder** hochladen.
- Bilder können auf zwei Ebenen gesetzt werden:
  1. **Umfrage-Ebene** (Header/Einleitung): unterhalb der Beschreibung, vor den Fragen
  2. **Fragen-Ebene**: zur Illustration einzelner Fragen, angezeigt über den Antwort-Optionen
- Bilder sind rein **illustrierend** — Abstimmende laden keine Bilder hoch.
- Bilder sind in beiden Formularen (Erstellen + Bearbeiten) **korrigierbar** (hinzufügen/entfernen).

---

## Datenbankschema

Neue Migration (nächste freie Nummer nach `024`):

```sql
ALTER TABLE public.umfragen
  ADD COLUMN IF NOT EXISTS bilder_urls text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.umfrage_fragen
  ADD COLUMN IF NOT EXISTS bilder_urls text[] NOT NULL DEFAULT '{}';
```

- Kein `NULL`-Default — Code arbeitet immer mit Array.
- Bestehende GRANTs in Migration `012_explicit_grants.sql` decken `authenticated` und `service_role` ab; neue Spalten erben diese.
- Keine RLS-Policy-Änderungen nötig (Spalten werden über bestehende Row-Level-Policies abgesichert).

---

## Storage

**Bucket:** `dorfly-media` (existiert, public, RLS: authenticated kann eigene Dateien hochladen und löschen)

**Pfade:**

| Kontext | Pfad |
|---|---|
| Erstellen (alle Bilder) | `umfragen/tmp/{userId}/{timestamp}_{filename}` |
| Bearbeiten (alle Bilder) | `umfragen/{umfrageId}/{timestamp}_{filename}` |

- Beim Erstellen ist noch keine `umfrageId` bekannt → `tmp/`-Präfix.
- Nach dem Absenden bleiben URLs unverändert im `tmp/`-Pfad, kein Kopieren.
- Beim Bearbeiten landen neue Uploads direkt unter `umfragen/{umfrageId}/`.
- Entfernte Bilder werden **nicht** aus dem Bucket gelöscht (Orphan-Cleanup ist kein Scope dieses Features).
- Kompression: bestehende `compressImage`-Utility (`src/lib/compressImage.ts`, max 1920px, JPEG 0.8).

---

## API-Routen

### `/api/umfragen/erstellen` (POST)

Zod-Schema-Erweiterung:
```typescript
bilder_urls: z.array(z.string().url()).optional().default([])
// auf Umfrage-Ebene UND pro Frage in fragen[]
```

DB-Insert übergibt `bilder_urls` an `umfragen` und jede `umfrage_fragen`-Zeile.

### `/api/umfragen/bearbeiten` (POST)

Zwei Erweiterungen:
1. `bilder_urls` für Umfrage-Metadaten → wird im UPDATE mitgeschrieben.
2. Neues optionales Feld `fragen_bilder: Array<{ id: string; bilder_urls: string[] }>` → aktualisiert **nur** `bilder_urls` auf bestehenden `umfrage_fragen`-Zeilen per ID (UPDATE, kein DELETE+INSERT).

> **Wichtig:** Die bestehende `fragen`-Option im bearbeiten-API (DELETE+INSERT aller Fragen) wird hier **nicht** genutzt, da sie per Cascade-Delete alle bestehenden `umfrage_antworten` löschen würde. Stattdessen werden Fragen-Bilder via separatem UPDATE-Pfad gesetzt, der die Fragen-IDs und damit die Abstimmungsdaten unberührt lässt.

---

## UI-Komponenten

### UmfrageErstellen (`src/components/umfrage/UmfrageErstellen.tsx`)

- Nach dem `Beschreibung`-Feld: `BilderUpload` für Umfrage-Bilder.
- Pro Fragencard: `BilderUpload` direkt unter dem Fragetext-Eingabefeld.
- `bilder_urls: string[]` wird im Fragen-State (neben `tempId`, `frage_text`, `typ`) geführt.
- Upload-Pfad: `umfragen/tmp/{userId}/{timestamp}_{filename}`.

### UmfrageBearbeiten (`src/components/umfrage/UmfrageBearbeiten.tsx`)

- Nach dem `Beschreibung`-Feld: `BilderUpload` für Umfrage-Bilder (vorbelegt aus DB).
- Neuer Abschnitt **„Fragen"** darunter:
  - Jede Frage als read-only Block (Fragetext + Typ als Label)
  - `BilderUpload` pro Frage (vorbelegt aus DB)
- Beim Laden: bestehende `bilder_urls` aus den übergebenen Umfrage-Daten (inkl. `umfrage_fragen`) vorbelegen.
- Beim Speichern: `fragen_bilder`-Array mit `{ id, bilder_urls }` pro Frage mitschicken (kein Delete+Recreate, Abstimmungsdaten bleiben erhalten).
- Upload-Pfad: `umfragen/{umfrageId}/{timestamp}_{filename}`.

### UmfrageCard (`src/components/umfrage/UmfrageCard.tsx`)

- **Umfrage-Ebene:** Bilder als horizontale Scroll-Galerie unterhalb von `beschreibung`, vor den Fragen. Nur gerendert wenn `bilder_urls.length > 0`.
- **Fragen-Ebene:** Bilder als horizontale Scroll-Galerie über den Antwort-Optionen jeder Frage. Nur gerendert wenn `bilder_urls.length > 0`.

---

## Barrierefreiheit

- Bilder im BilderUpload-Kontext: keine inhaltliche Information, daher `alt=""` (dekorativ).
- Upload-Button: vorhandenes `BilderUpload`-Pattern mit `aria-label` beibehalten.
- Scroll-Galerie in UmfrageCard: `role="list"` + `role="listitem"` pro Bild.

---

## Nicht im Scope

- Löschen von Orphan-Dateien im Storage-Bucket
- Bildbearbeitung / Cropping
- Bürger laden Bilder hoch (nur Ersteller)
- Drag-and-Drop Reihenfolge der Bilder
