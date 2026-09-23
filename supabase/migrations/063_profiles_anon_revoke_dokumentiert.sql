-- 063: Ist-Zustand festschreiben — anon darf public.profiles nicht lesen.
--
-- Das Projekt entstand vor dem Stichtag, ab dem Supabase keine automatischen
-- Grants auf public-Tabellen mehr vergibt. anon hatte dadurch per Default-Grant
-- SELECT auf profiles. Bei der profiles-Haertung (043/057, seinerzeit manuell auf
-- dorfly-production ausgefuehrt) wurde das Recht entzogen, ohne dass es in einer
-- Migration festgehalten wurde.
--
-- Folge: Ein frisch aus den Migrations aufgesetztes Projekt (Staging, lokal, neue
-- Gemeinde) haette anon-Leserechte auf profiles, die Produktion nicht. Die
-- oeffentliche Post-Seite /posts/[id] lieferte deshalb in Produktion 404, lokal
-- aber nicht — der Fehler war dort nicht reproduzierbar.
--
-- Diese Migration aendert in Produktion nichts (das Recht ist dort bereits weg).
-- Sie sorgt dafuer, dass jede Umgebung denselben Stand hat.
--
-- Anonyme Leser erhalten Profildaten ausschliesslich ueber die maskierte View
-- public.profiles_public (060), die sensible Felder auf NULL setzt.

revoke select on public.profiles from anon;
