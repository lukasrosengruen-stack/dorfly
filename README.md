# Dorfly

Kommunale Bürger-App für deutsche Gemeinden. Gebaut mit Next.js 16, Supabase und TypeScript.

---

## Datenbankkonventionen (Supabase)

**Jede neue Migration muss explizite GRANTs enthalten.** Ab Oktober 2026 vergibt Supabase keine automatischen Grants mehr auf `public`-Tabellen — ohne expliziten GRANT gibt PostgREST einen `42501`-Fehler zurück und die Tabelle ist über `supabase-js` unsichtbar.

### Template für neue Migrations

```sql
-- Tabelle anlegen
create table public.meine_tabelle (
  id uuid primary key default gen_random_uuid(),
  -- ...
);

-- RLS aktivieren
alter table public.meine_tabelle enable row level security;

-- GRANTs (immer explizit angeben)
-- Nur anon hinzufügen wenn die Tabelle wirklich ohne Login erreichbar sein soll
grant select on public.meine_tabelle to anon;                          -- optional
grant select, insert, update, delete on public.meine_tabelle to authenticated;

-- RLS-Policies
create policy "..." on public.meine_tabelle for select using (...);
-- ...
```

### Wann welche Rolle?

| Rolle | Wann |
|---|---|
| `anon` | Nur wenn die Tabelle ohne Login erreichbar sein muss (z.B. gemeinden für Slug-Routing, posts für OG-Sharing) |
| `authenticated` | Alle Tabellen die im eingeloggten Bereich genutzt werden |
| `service_role` | Kein expliziter Grant nötig — service_role umgeht RLS und hat immer Zugriff |

### Bestehende Grants

Alle bestehenden Tabellen sind in [supabase/migrations/012_explicit_grants.sql](supabase/migrations/012_explicit_grants.sql) abgedeckt.

> **Hinweis:** Die `einladungen`-Tabelle wurde manuell im Supabase-Dashboard angelegt und fehlt noch als Migration. Sie wird ausschließlich über `service_role` in API-Routen zugegriffen — kein Client-GRANT nötig.

---

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
