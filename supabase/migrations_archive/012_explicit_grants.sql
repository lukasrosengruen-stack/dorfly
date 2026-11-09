-- Explizite GRANTs für alle bestehenden public-Schema-Tabellen
--
-- Hintergrund: Ab Mai 2026 (neue Projekte) bzw. Oktober 2026 (alle Projekte)
-- gewährt Supabase keine automatischen Grants mehr auf public-Tabellen.
-- Ohne expliziten GRANT gibt PostgREST einen 42501-Fehler zurück.
--
-- Regel für alle zukünftigen Migrations: siehe README.md → Datenbankkonventionen

-- ─── gemeinden ────────────────────────────────────────────────────────────────
-- anon benötigt SELECT für slug-basiertes Routing vor dem Login
grant select on public.gemeinden to anon, authenticated;

-- ─── profiles ─────────────────────────────────────────────────────────────────
grant select, insert, update on public.profiles to authenticated;

-- ─── organisationen ───────────────────────────────────────────────────────────
grant select, insert, update, delete on public.organisationen to authenticated;

-- ─── posts ────────────────────────────────────────────────────────────────────
-- anon benötigt SELECT für /posts/[id] (öffentliche OG-Sharing-Route)
grant select on public.posts to anon;
grant select, insert, update, delete on public.posts to authenticated;

-- ─── maengel ──────────────────────────────────────────────────────────────────
grant select, insert, update, delete on public.maengel to authenticated;

-- ─── fragen ───────────────────────────────────────────────────────────────────
grant select, insert, update on public.fragen to authenticated;

-- ─── sms_verifications ────────────────────────────────────────────────────────
-- Kein Grant: ausschließlich über service_role in API-Routen zugegriffen.
-- RLS-Policy blockiert anon/authenticated ohnehin komplett (using (false)).

-- ─── gewerbe_abonnements ──────────────────────────────────────────────────────
grant select, insert, delete on public.gewerbe_abonnements to authenticated;

-- ─── gewerbe_branchen ─────────────────────────────────────────────────────────
-- anon: Lookup-Tabelle, kann vor Login beim Filtern gebraucht werden
grant select on public.gewerbe_branchen to anon, authenticated;

-- ─── abfalltermine ────────────────────────────────────────────────────────────
grant select on public.abfalltermine to authenticated;

-- ─── abfallkalender_einstellungen ─────────────────────────────────────────────
grant select on public.abfallkalender_einstellungen to authenticated;

-- ─── abfallkalender_praeferenzen ──────────────────────────────────────────────
grant select, insert, update, delete on public.abfallkalender_praeferenzen to authenticated;

-- ─── verein_kategorien ────────────────────────────────────────────────────────
grant select on public.verein_kategorien to authenticated;

-- ─── vereine ──────────────────────────────────────────────────────────────────
grant select, insert, update, delete on public.vereine to authenticated;

-- ─── verein_abonnements ───────────────────────────────────────────────────────
grant select, insert, delete on public.verein_abonnements to authenticated;

-- ─── einladungen ──────────────────────────────────────────────────────────────
-- Tabelle wurde manuell im Supabase-Dashboard angelegt (nicht in Migrations).
-- Zugriff ausschließlich über service_role in API-Routen → kein Grant nötig.
-- TODO: Migration für Tabellendefinition nachliefern (einladungen_definition.sql)
