-- Nachträgt die Erweiterungen der posts-Tabelle nach, die manuell im Supabase-Dashboard
-- angelegt wurden (nicht via Migration erfasst). Alle Statements sind idempotent.

-- ─── post_status Enum ────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_status') THEN
    CREATE TYPE public.post_status AS ENUM ('pending', 'published', 'rejected');
  END IF;
END $$;

-- ─── post_channel um 'gemeinderat' erweitern ─────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.post_channel'::regtype
      AND enumlabel = 'gemeinderat'
  ) THEN
    ALTER TYPE public.post_channel ADD VALUE 'gemeinderat';
  END IF;
END $$;

-- ─── posts-Tabelle: fehlende Spalten hinzufügen ───────────────────────────────
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS tag                text,
  ADD COLUMN IF NOT EXISTS bilder_urls        text[],
  ADD COLUMN IF NOT EXISTS publish_at         timestamptz,
  ADD COLUMN IF NOT EXISTS veranstaltung_datum timestamptz,
  ADD COLUMN IF NOT EXISTS veranstaltung_ort  text,
  ADD COLUMN IF NOT EXISTS sichtbarkeit       text;

-- status als post_status Enum-Spalte hinzufügen (nur wenn sie noch nicht existiert)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'posts'
      AND column_name  = 'status'
  ) THEN
    ALTER TABLE public.posts
      ADD COLUMN status public.post_status NOT NULL DEFAULT 'published';
  END IF;
END $$;
