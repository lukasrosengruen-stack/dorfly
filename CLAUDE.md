@AGENTS.md

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

**Jede neue Migration muss explizite GRANTs enthalten.** Ab Oktober 2026 vergibt Supabase keine automatischen Grants mehr auf `public`-Tabellen — ohne expliziten GRANT gibt PostgREST `42501` zurück.

### Template für neue Migrations

```sql
create table public.meine_tabelle (
  id uuid primary key default gen_random_uuid(),
  -- ...
);

alter table public.meine_tabelle enable row level security;

-- anon nur wenn die Tabelle wirklich ohne Login erreichbar sein soll
grant select on public.meine_tabelle to anon;                          -- optional
grant select, insert, update, delete on public.meine_tabelle to authenticated;

create policy "..." on public.meine_tabelle for select using (...);
```

### Wann welche Rolle?

| Rolle | Wann |
|---|---|
| `anon` | Nur für Tabellen ohne Login (z.B. `gemeinden` für Slug-Routing) |
| `authenticated` | Alle Tabellen im eingeloggten Bereich |
| `service_role` | Kein GRANT nötig — umgeht RLS, nur in API-Routen |

Bestehende Grants: [supabase/migrations/012_explicit_grants.sql](supabase/migrations/012_explicit_grants.sql)

> `einladungen`-Tabelle wurde manuell im Dashboard angelegt (keine Migration). Zugriff ausschließlich via `service_role` in API-Routen.

---

## Barrierefreiheit (WCAG 2.2 AA)

Dorfly ist eine kommunale Plattform. Barrierefreiheit ist keine Option, sondern Grundanforderung (BITV 2.0, EN 301 549).

**Vollständiger Audit und Maßnahmenplan:** `docs/accessibility/`

### Regeln die immer gelten

- Jedes `<input>` und `<textarea>` braucht ein verknüpftes `<label>` (kein `placeholder` als Ersatz).
- Kein `<div onClick>` oder `<span onClick>` für Interaktionen. Immer `<button>` oder `<a>`.
- Icon-Only-Buttons brauchen `aria-label`. Icons neben Text-Labels brauchen `aria-hidden="true"`.
- Modals brauchen `role="dialog"`, `aria-modal="true"`, Fokus-Trap und Fokus-Restore.
- Akkordeons und Toggles brauchen `aria-expanded`.
- Tabs brauchen `role="tablist"`, `role="tab"`, `aria-selected`, `role="tabpanel"`.
- Fehlermeldungen brauchen `role="alert"` oder `aria-live="assertive"`.
- Aktive Navigation braucht `aria-current="page"`.
- `maximumScale` darf nie auf `1` gesetzt werden (sperrt User-Zoom, SC 1.4.4).

### Gemeinsame zugängliche Komponenten

Neue UI-Muster nicht inline bauen — erst prüfen ob eine gemeinsame Komponente existiert oder erstellt werden sollte:

| Muster | Komponente |
|---|---|
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
