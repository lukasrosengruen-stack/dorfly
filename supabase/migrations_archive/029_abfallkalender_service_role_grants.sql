-- Explizite GRANTs für service_role auf Abfallkalender-Tabellen.
-- Hintergrund: In neuen Supabase-Projekten (ab Mai 2026) werden keine automatischen
-- Grants mehr an service_role vergeben. service_role umgeht zwar RLS (BYPASSRLS),
-- benötigt aber trotzdem table-level GRANTs für DML-Operationen.

-- ─── abfalltermine ────────────────────────────────────────────────────────────
-- service_role: Import-Route löscht und schreibt alle Termine per Reimport
grant select, insert, delete on public.abfalltermine to service_role;

-- ─── abfallkalender_einstellungen ─────────────────────────────────────────────
-- service_role: Import-Route führt upsert (insert + update) nach jedem Import durch
grant select, insert, update on public.abfallkalender_einstellungen to service_role;
