# Feature-Flag-System — Design-Spezifikation

**Datum:** 2026-05-23  
**Status:** Bereit zur Implementierung

---

## Überblick

Dorfly-Gemeinden sollen optional Features aktivieren können. Ein Super-Admin steuert pro Gemeinde welche Features aktiv sind. Deaktivierte Features verschwinden aus der Navigation und ihre Routen leiten auf `/home` um.

---

## Datenmodell

### `gemeinden.features` (JSONB)

Bereits vorhandene Spalte. Neues TypeScript-Schema:

```typescript
type GemeindeFeatures = {
  abfallkalender?:      boolean  // war: wasteCalendarEnabled
  umfragen?:            boolean
  gemeinderat?:         boolean
  gewerbe?:             boolean  // deckt /lokale-angebote + /gewerbe/* ab
  vereine?:             boolean
  marktplatz?:          boolean
  buergermeisterLabel?: 'buergermeister' | 'verwaltung'  // default: 'buergermeister'
}
```

**Defaults:** Alle Feature-Flags defaulten zu `false`. `buergermeisterLabel` defaultet zu `'buergermeister'`.

**Migration:** Bestehende `wasteCalendarEnabled`-Keys in `features` werden per SQL-Migration zu `abfallkalender` umbenannt.

### Zentrales Helper-Modul `src/lib/features.ts`

```typescript
export function getFeatures(gemeinde: { features: unknown }): GemeindeFeatures
export function isFeatureAktiv(gemeinde: { features: unknown }, feature: keyof GemeindeFeatures): boolean
export function getBuergermeisterLabel(features: GemeindeFeatures): string
// → "Frag den Bürgermeister" | "Frag die Verwaltung"
```

---

## Core Features (immer aktiv, kein Toggle)

- Newsfeed (`/feed`)
- Veranstaltungen (`/veranstaltungen`)
- Mängel melden (`/maengel`)
- Frag den Bürgermeister/Verwaltung (`/buergermeister`) — Name konfigurierbar

---

## Optionale Features (Toggle)

| Feature | Route(n) | Flag-Key |
|---|---|---|
| Abfallkalender | `/abfallkalender`, `/abfallkalender/einstellungen` | `abfallkalender` |
| Umfragen | `/umfragen` | `umfragen` |
| Gemeinderat | `/gemeinderat` | `gemeinderat` |
| Gewerbe & Lokale Angebote | `/lokale-angebote`, `/gewerbe/*` | `gewerbe` |
| Vereine | `/vereine` | `vereine` |
| Marktplatz | `/marktplatz` | `marktplatz` |

---

## Super Admin UI

### Trigger

Im Header des Super-Admin-Dashboards erscheint ein `Settings`-Icon (`⚙`) rechts neben dem Gemeinde-Selektor — **nur wenn eine Gemeinde ausgewählt ist** (nicht bei „Alle Gemeinden").

```
[ Super-Admin-Dashboard ]  [ Gemeinde: Musterbach ▼ ] [⚙] [ Abmelden ]
```

### Slide-over Panel (`GemeindeKonfigSlideOver`)

- Öffnet von rechts, überlagert den Inhalt (kein Seitenwechsel)
- Schließen via `×`-Button oder Klick auf den Backdrop

**Abschnitt 1: Features**

Jede Zeile: Feature-Name + Toggle-Switch. Toggle-Klick speichert sofort (kein Speichern-Button).

| Feature | Toggle |
|---|---|
| Abfallkalender | AN/AUS |
| Umfragen | AN/AUS |
| Gemeinderat | AN/AUS |
| Gewerbe & Lokale Angebote | AN/AUS |
| Vereine | AN/AUS |
| Marktplatz | AN/AUS |

**Abschnitt 2: Einstellungen**

- **„Frag den…"-Bezeichnung:** Radio-Auswahl `Bürgermeister` / `Verwaltung`

### Speicherverhalten

Jede Änderung (Toggle-Klick, Radio-Auswahl) feuert sofort `PATCH /api/admin/gemeinden/[id]/features`. Optimistic Update: UI ändert sich sofort, bei Fehler wird zurückgesetzt + Toast-Fehlermeldung.

---

## API

### `PATCH /api/admin/gemeinden/[id]/features`

- **Auth:** `super_admin` only
- **Body:** `Partial<GemeindeFeatures>`
- **Logik:** Merged Partial in bestehendes `features`-Objekt (kein vollständiges Überschreiben)
- **Response:** `{ features: GemeindeFeatures }`

---

## Enforcement

### Navigation (`SidebarNav`, `BottomNav`)

`getGemeinde()` gibt bereits die volle Gemeinde-Zeile inkl. `features` zurück — kein zusätzlicher DB-Query nötig.

- `src/app/(app)/layout.tsx` übergibt `gemeinde.features` als Props an `BottomNav`
- `src/app/(admin)/layout.tsx` übergibt `gemeinde.features` als Props an `SidebarNav`

Nav-Items für deaktivierte Features werden nicht gerendert.

Der Label für `/buergermeister` wird aus `buergermeisterLabel` bestimmt:
- `'buergermeister'` → „Bürgerfragen" (Sidebar) / „Frag BM" (BottomNav)
- `'verwaltung'` → „Frag die Verwaltung" (Sidebar) / „Frag VW" (BottomNav)

**Edge case Gewerbe:** Der `gewerbe`-Toggle steuert die Sichtbarkeit für Bürger (`/lokale-angebote`). Gewerbe-Nutzer können ihr eigenes Dashboard (`/gewerbe/dashboard`) weiterhin nutzen — unabhängig vom Toggle.

### Routen-Guard

Jede optionale Feature-Seite (`page.tsx`) prüft das Flag am Anfang:

```typescript
const featureAktiv = isFeatureAktiv(gemeinde, 'abfallkalender')
if (!featureAktiv) redirect('/home')
```

`/abfallkalender` und `/abfallkalender/einstellungen` haben diesen Guard bereits — wird auf das neue Helper-Modul umgestellt.

### Verwaltungsdashboard

`AbfallkalenderSection` bleibt hinter `wasteFeatureAktiv`-Check — wird auf `isFeatureAktiv` umgestellt. Gleiches Muster für zukünftige Feature-spezifische Dashboard-Sections.

---

## Migration

Neue SQL-Migration `028_feature_flags.sql`:

```sql
-- Umbenennung wasteCalendarEnabled → abfallkalender
UPDATE gemeinden
SET features = features - 'wasteCalendarEnabled' || 
  CASE WHEN (features->>'wasteCalendarEnabled')::boolean 
    THEN '{"abfallkalender": true}'::jsonb 
    ELSE '{"abfallkalender": false}'::jsonb 
  END
WHERE features ? 'wasteCalendarEnabled';
```

---

## Dateien die neu erstellt werden

| Datei | Zweck |
|---|---|
| `src/lib/features.ts` | Zentrales Helper-Modul für Feature-Flag-Logik |
| `src/app/admin/dashboard/GemeindeKonfigSlideOver.tsx` | Slide-over UI-Komponente |
| `src/app/api/admin/gemeinden/[id]/features/route.ts` | PATCH-Endpunkt |
| `supabase/migrations/028_feature_flags.sql` | Key-Umbenennung |

## Dateien die geändert werden

| Datei | Änderung |
|---|---|
| `src/app/admin/dashboard/AdminDashboardClient.tsx` | Settings-Icon + SlideOver einbinden |
| `src/app/admin/dashboard/types.ts` | `GemeindeFeatures`-Typ exportieren |
| `src/components/layout/SidebarNav.tsx` | Feature-abhängige Nav-Items + Label |
| `src/components/layout/BottomNav.tsx` | Feature-abhängige Nav-Items + Label |
| `src/app/(app)/layout.tsx` | `features` aus `gemeinde` an `BottomNav` weitergeben |
| `src/app/(admin)/layout.tsx` | `features` aus `gemeinde` an `SidebarNav` weitergeben |
| `src/app/(app)/abfallkalender/page.tsx` | Auf `isFeatureAktiv` umstellen |
| `src/app/(app)/abfallkalender/einstellungen/page.tsx` | Auf `isFeatureAktiv` umstellen |
| `src/app/(app)/umfragen/page.tsx` | Route-Guard hinzufügen |
| `src/app/(app)/gemeinderat/page.tsx` | Route-Guard hinzufügen |
| `src/app/(app)/lokale-angebote/page.tsx` | Route-Guard hinzufügen |
| `src/app/(app)/vereine/page.tsx` | Route-Guard hinzufügen |
| `src/app/(app)/marktplatz/page.tsx` | Route-Guard hinzufügen |
| `src/app/(admin)/dashboard/page.tsx` | Auf `isFeatureAktiv` umstellen |
