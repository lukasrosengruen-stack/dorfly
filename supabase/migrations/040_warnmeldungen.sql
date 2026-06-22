-- 040_warnmeldungen.sql
-- Warnmeldungs-Typ für Posts + DWD-Konfigurationsfeld auf Gemeinden

-- 1. Neuer Post-Channel
ALTER TYPE public.post_channel ADD VALUE IF NOT EXISTS 'warnung';

-- 2. author_id nullable (DWD-Posts haben keinen menschlichen Autor)
ALTER TABLE public.posts ALTER COLUMN author_id DROP NOT NULL;

-- 3. DWD-spezifische Spalten
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS dwd_id     text,
  ADD COLUMN IF NOT EXISTS severity   smallint,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_active  boolean NOT NULL DEFAULT true;

-- 4. Unique-Index verhindert doppeltes Anlegen derselben DWD-Warnung
CREATE UNIQUE INDEX IF NOT EXISTS posts_dwd_id_unique
  ON public.posts(dwd_id)
  WHERE dwd_id IS NOT NULL;

-- 5. Warncell-ID für DWD-Polling
ALTER TABLE public.gemeinden
  ADD COLUMN IF NOT EXISTS warncell_id text;

-- Keine neuen GRANTs nötig:
-- - service_role: DWD-Cron und Deaktivierungs-Route nutzen createServiceClient()
--   das bypassed RLS und braucht keine expliziten GRANTs für neue Spalten
-- - authenticated: bestehende Grants auf posts/gemeinden decken neue Spalten ab
