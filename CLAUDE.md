@AGENTS.md

# Kommunikation

**Immer auf Deutsch antworten.** Das gilt für alles, was im Terminal ausgegeben wird: Erklärungen, Rückfragen, Zusammenfassungen, Auswahlmöglichkeiten und Fortschrittsmeldungen. Auch dann, wenn die Anfrage auf Englisch gestellt wurde oder Fehlermeldungen und Logs englisch sind.

Davon unberührt bleiben:

- **Code**, inklusive Bezeichner und Code-Kommentare — dort gelten die Projektkonventionen weiter (deutsche Fachbegriffe wie `gemeinde_id`, ansonsten die Sprache der umgebenden Datei).
- **Commit-Messages** — Deutsch, aber ohne Umlaute (`gueltig`, `zuruecknehmen`), passend zur bestehenden Historie.
- **Zitierte Ausgaben** wie Fehlermeldungen, Logs und Testergebnisse werden im Original wiedergegeben, nicht übersetzt.

# Dorfly — Projektübersicht

Kommunale Bürger-App für deutsche Gemeinden (bis ~15.000 Einwohner). Features: Umfragen, Gemeinderats-Forum, Mängelmelder, Abfallkalender, Gewerbe-/Vereinsverzeichnis, Push-Benachrichtigungen, PWA.

Stack: Next.js 16 · React 19 · TypeScript · Supabase (DB + Auth) · Tailwind v4 · Zod · Zustand

---

## Architektur

### Route Groups (App Router)

```
src/app/
├── (auth)/        # Login, Passwort-Reset — kein Layout-Wrapper
├── (admin)/       # Admin-Dashboard — eigenes Layout
├── (app)/         # Haupt-App — umfragen, maengel, vereine, gewerbe, …
└── api/           # API-Routen (REST + Cron)
```

### Feature-Module

Größere Features leben in `src/features/<name>/` (z.B. `feed/`, `gewerbe/`, `maengel/`, `verein/`). Wiederverwendbare UI-Primitives in `src/components/ui/`. Geteilte Komponenten in `src/components/`.

---

## Konventionen

- **Sprache:** Deutsche Variablen- und Tabellennamen sind Konvention im Projekt (`gemeinde_id`, `mängel`, `verein_name`, …).
- **Formulare:** Immer `react-hook-form` + `zod` + `@hookform/resolvers`. Kein manuelles `useState` für Formulare.
- **Supabase-Client:** `src/lib/supabase/` enthält Client-Factories — richtigen Client für den Kontext wählen (Browser, Server, Service-Role).

### Wann welcher Supabase-Client?

| Kontext | Client |
|---|---|
| Server Component / Server Action | `createServerClient` (SSR) |
| API-Route mit Admin-Rechten | `createServiceRoleClient` |
| Client Component | `createBrowserClient` |

---

## Datenbankkonventionen (Supabase)

**Jede neue Migration muss explizite GRANTs enthalten** — für alle beteiligten Rollen. Ab Mai 2026 (neue Projekte) vergibt Supabase keine automatischen Grants mehr auf `public`-Tabellen, auch nicht für `service_role`. Ohne expliziten GRANT gibt PostgREST `42501` zurück.

### Template für neue Migrations

```sql
create table public.meine_tabelle (
  id uuid primary key default gen_random_uuid(),
  -- ...
);

alter table public.meine_tabelle enable row level security;

-- anon nur wenn die Tabelle wirklich ohne Login erreichbar sein soll
grant select on public.meine_tabelle to anon;                                       -- optional
grant select, insert, update, delete on public.meine_tabelle to authenticated;

-- service_role braucht explizite GRANTs für alle DML-Operationen, die API-Routen nutzen
grant select, insert, update, delete on public.meine_tabelle to service_role;       -- nur nötige Rechte

create policy "..." on public.meine_tabelle for select using (...);
```

### Wann welche Rolle?

| Rolle | Wann |
|---|---|
| `anon` | Nur für Tabellen ohne Login (z.B. `gemeinden` für Slug-Routing) |
| `authenticated` | Alle Tabellen im eingeloggten Bereich |
| `service_role` | Tabellen die ausschließlich über API-Routen (service client) beschrieben werden — **expliziter GRANT erforderlich** |

Bestehende Grants: [supabase/migrations/012_explicit_grants.sql](supabase/migrations/012_explicit_grants.sql)

> `einladungen`-Tabelle wurde manuell im Dashboard angelegt (keine Migration). Zugriff ausschließlich via `service_role` in API-Routen.

---

## Barrierefreiheit (WCAG 2.2 AA)

Dorfly ist eine kommunale Plattform. Barrierefreiheit ist **Pflichtanforderung**, keine Option (BITV 2.0, EN 301 549, BFSG). Das gilt für jedes neue Feature und jede Änderung — nicht nur für dedizierte Accessibility-Tickets.

**Vollständiger Audit und Maßnahmenplan:** `docs/accessibility/`

### Checkliste — bei jedem neuen Feature prüfen

Vor dem Commit jede Frage durchgehen:

- [ ] Alle `<input>` und `<textarea>` haben ein verknüpftes `<label>` (kein `placeholder` als Ersatz)
- [ ] Keine `<div onClick>` oder `<span onClick>` — immer `<button>` oder `<a>`
- [ ] Icon-Only-Buttons haben `aria-label`. Icons neben sichtbarem Text haben `aria-hidden="true"`
- [ ] Neue Modals/Bottom-Sheets: `role="dialog"`, `aria-modal="true"`, `useFocusTrap` aus `src/hooks/useFocusTrap.ts`, Fokus-Restore beim Schließen
- [ ] Akkordeons und Toggles haben `aria-expanded`
- [ ] Neue Tab-Navigationen: `role="tablist"`, `role="tab"`, `aria-selected`, `role="tabpanel"`
- [ ] Fehlermeldungen haben `role="alert"`
- [ ] Neue Routen haben `export const metadata` mit aussagekräftigem Seitentitel
- [ ] Texte mit Informationsgehalt haben mindestens 4.5:1 Kontrast (kein `text-gray-400` für Fließtext — `text-gray-500` minimum)
- [ ] Nutzer-generierte Inhalte (Posts, Fragen, Meldungen) haben einen `<ReportButton>` aus `src/components/ReportButton.tsx`

### Regeln die immer gelten

- `maximumScale` darf nie auf `1` gesetzt werden (sperrt User-Zoom, SC 1.4.4)
- Aktive Navigation braucht `aria-current="page"`
- Umfrage-/Auswahl-Widgets: `role="radiogroup"` + `role="radio"` + `aria-checked` (siehe `UmfrageCard.tsx` als Referenz)

### Gemeinsame zugängliche Komponenten

Neue UI-Muster nicht inline bauen — erst prüfen ob eine gemeinsame Komponente existiert:

| Muster | Komponente |
|---|---|
| Fokus-Trap in Modals | `src/hooks/useFocusTrap.ts` ✓ |
| DSA-Meldung auf UGC | `src/components/ReportButton.tsx` ✓ |
| Modale / Bottom-Sheets | `src/components/ui/Modal.tsx` (noch zu erstellen) |
| Formularfelder mit Label + Fehler | `src/components/ui/FormField.tsx` (noch zu erstellen) |
| Icon-Only-Button | `src/components/ui/IconButton.tsx` (noch zu erstellen) |
| Tab-Navigation | `src/components/ui/Tabs.tsx` (noch zu erstellen) |

---

## Lokale Entwicklung

```bash
npm run dev          # Dev-Server
npm run build        # Production-Build
npm run test         # Vitest (einmalig)
npm run test:watch   # Vitest (Watch-Modus)
npm run db:types     # Supabase TypeScript-Typen generieren
```

Benötigte Umgebungsvariablen (siehe `.env.local`):
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TWILIO_*` (SMS), `RESEND_*` (E-Mail), `NEXT_PUBLIC_ONESIGNAL_APP_ID` (Push)
- `NEXT_PUBLIC_APP_URL`
