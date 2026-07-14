-- Sammlungstermine (Altpapier-, Altkleider-, Altglas-, Schrottsammlung) als neue
-- Beitragskategorie "sammlung". Keine neue Tabelle: Bürger-Kalender und Cron-Job
-- fragen posts direkt ab (siehe docs/superpowers/specs/2026-07-14-abfallkalender-sammlungen-design.md).
-- Keine neuen GRANTs nötig — bestehende Grants auf public.posts
-- (012_explicit_grants.sql, 030_posts_service_role_grants.sql) decken die neuen Spalten ab.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS sammlung_art         text,
  ADD COLUMN IF NOT EXISTS sammlung_datum       date,
  ADD COLUMN IF NOT EXISTS sammlung_organisator text;

DO $$
BEGIN
  ALTER TABLE public.posts
    ADD CONSTRAINT posts_sammlung_felder_check
    CHECK (
      tag <> 'sammlung'
      OR (
        sammlung_art IN ('altpapier', 'altkleider', 'altglas', 'schrott')
        AND sammlung_datum IS NOT NULL
        AND sammlung_organisator IS NOT NULL
        AND length(trim(sammlung_organisator)) > 0
      )
    );
EXCEPTION WHEN duplicate_object THEN
  NULL; -- Constraint existiert bereits, nichts zu tun
END $$;

-- Für Bürger-Kalender-Abfrage und Cron-Benachrichtigungen
CREATE INDEX IF NOT EXISTS idx_posts_sammlung
  ON public.posts (gemeinde_id, sammlung_datum)
  WHERE tag = 'sammlung' AND status = 'published';
