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
