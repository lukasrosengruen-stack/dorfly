-- Explizite GRANTs für service_role auf posts-Tabelle.
-- Hintergrund: In neuen Supabase-Projekten (ab Mai 2026) werden keine automatischen
-- Grants mehr an service_role vergeben. service_role umgeht zwar RLS (BYPASSRLS),
-- benötigt aber trotzdem table-level GRANTs für DML-Operationen.
--
-- Betrifft folgende API-Routen:
--   /api/gemeinderat/post  → INSERT
--   /api/posts/freigeben   → SELECT + UPDATE
--   /api/verein/post       → INSERT + UPDATE + DELETE
--   /api/posts/delete      → DELETE
--   /api/posts/update      → UPDATE

grant select, insert, update, delete on public.posts to service_role;
