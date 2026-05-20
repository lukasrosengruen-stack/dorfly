-- Fehlende GRANTs für Tabellen ohne explizite Berechtigungen.
-- Hintergrund: Ab Oktober 2026 keine automatischen Grants mehr (Supabase-Breaking-Change).
-- Zugehörige RLS-Policies wurden im Dashboard angelegt.

-- ─── umfragen ────────────────────────────────────────────────────────────────
grant select, insert, update, delete on public.umfragen to authenticated;

-- ─── umfrage_fragen ──────────────────────────────────────────────────────────
grant select, insert, update, delete on public.umfrage_fragen to authenticated;

-- ─── umfrage_optionen ────────────────────────────────────────────────────────
grant select, insert, update, delete on public.umfrage_optionen to authenticated;

-- ─── umfrage_antworten ───────────────────────────────────────────────────────
-- Schreiben geht über service_role (abstimmen-Route), Lesen via authenticated (meine-daten)
grant select, insert, delete on public.umfrage_antworten to authenticated;

-- ─── umfrage_teilnahmen ──────────────────────────────────────────────────────
grant select, insert, delete on public.umfrage_teilnahmen to authenticated;

-- ─── gemeinderat_fragen ──────────────────────────────────────────────────────
grant select, insert, update, delete on public.gemeinderat_fragen to authenticated;

-- ─── rollen_log ──────────────────────────────────────────────────────────────
-- INSERT via authenticated (Rollenverwaltungs-Routen); SELECT nur über service_role im Dashboard
grant select, insert on public.rollen_log to authenticated;
