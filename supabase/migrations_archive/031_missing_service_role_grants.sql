-- Explizite GRANTs für service_role auf allen Tabellen, die via API-Routen
-- mit createServiceClient() beschrieben oder gelesen werden.
--
-- Hintergrund: In neuen Supabase-Projekten (ab Mai 2026) werden keine automatischen
-- Grants mehr an service_role vergeben. service_role umgeht zwar RLS (BYPASSRLS),
-- benötigt aber trotzdem table-level GRANTs für DML-Operationen.
--
-- Bereits abgedeckt (frühere Migrations):
--   profiles                 → 014_profiles_phone_nullable.sql
--   gemeinden                → 014_profiles_phone_nullable.sql
--   newsletter_subscribers   → 022_newsletter_subscribers.sql
--   abfalltermine            → 029_abfallkalender_service_role_grants.sql
--   abfallkalender_einstellungen → 029_abfallkalender_service_role_grants.sql
--   posts                    → 030_posts_service_role_grants.sql

-- ─── fragen ──────────────────────────────────────────────────────────────────
-- /api/fragen/delete (DELETE), /api/fragen/update (UPDATE), /api/auth/loeschen (DELETE)
grant select, update, delete on public.fragen to service_role;

-- ─── maengel ─────────────────────────────────────────────────────────────────
-- /api/maengel/delete (DELETE), /api/maengel/status (UPDATE), /api/auth/loeschen (DELETE)
grant select, update, delete on public.maengel to service_role;

-- ─── gemeinderat_fragen ──────────────────────────────────────────────────────
-- /api/gemeinderat/frage (INSERT), /api/gemeinderat/antwort (SELECT + UPDATE),
-- /api/auth/loeschen (DELETE)
grant select, insert, update, delete on public.gemeinderat_fragen to service_role;

-- ─── umfragen ────────────────────────────────────────────────────────────────
-- /api/umfragen/erstellen (INSERT), /api/umfragen/bearbeiten (SELECT + UPDATE),
-- /api/umfragen/loeschen (DELETE), /api/auth/loeschen (DELETE)
grant select, insert, update, delete on public.umfragen to service_role;

-- ─── umfrage_fragen ──────────────────────────────────────────────────────────
-- /api/umfragen/erstellen (INSERT), /api/umfragen/bearbeiten (DELETE + INSERT)
grant select, insert, update, delete on public.umfrage_fragen to service_role;

-- ─── umfrage_optionen ────────────────────────────────────────────────────────
-- /api/umfragen/erstellen (INSERT), /api/umfragen/bearbeiten (DELETE + INSERT)
grant select, insert, update, delete on public.umfrage_optionen to service_role;

-- ─── umfrage_antworten ───────────────────────────────────────────────────────
-- /api/umfragen/abstimmen (INSERT), /api/auth/loeschen (DELETE)
grant select, insert, delete on public.umfrage_antworten to service_role;

-- ─── umfrage_teilnahmen ──────────────────────────────────────────────────────
-- /api/umfragen/abstimmen (INSERT), /api/auth/loeschen (DELETE)
grant select, insert, delete on public.umfrage_teilnahmen to service_role;

-- ─── vereine ─────────────────────────────────────────────────────────────────
-- /api/verwaltung/nutzer/rolle (SELECT + INSERT + UPDATE)
grant select, insert, update on public.vereine to service_role;

-- ─── organisationen ──────────────────────────────────────────────────────────
-- /api/verwaltung/nutzer/rolle (SELECT + INSERT + UPDATE)
grant select, insert, update on public.organisationen to service_role;

-- ─── rollen_log ──────────────────────────────────────────────────────────────
-- /api/verwaltung/nutzer/rolle (INSERT)
grant select, insert on public.rollen_log to service_role;
