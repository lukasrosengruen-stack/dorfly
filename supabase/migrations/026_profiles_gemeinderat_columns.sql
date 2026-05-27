-- Fügt die gemeinderat-spezifischen Spalten zu profiles nach, die manuell im
-- Supabase-Dashboard angelegt wurden (nicht via Migration erfasst).
-- Alle Statements sind idempotent.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fraktion      text,
  ADD COLUMN IF NOT EXISTS ueber_mich    text,
  ADD COLUMN IF NOT EXISTS kontakt_email text;
