-- Bilder-URLs für Umfragen (Header) und einzelne Fragen (illustrierend)
ALTER TABLE public.umfragen
  ADD COLUMN IF NOT EXISTS bilder_urls text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.umfrage_fragen
  ADD COLUMN IF NOT EXISTS bilder_urls text[] NOT NULL DEFAULT '{}';
