-- Sammlungstermine bekommen eine Uhrzeit, analog zu veranstaltung_datum: sammlung_datum
-- wird von date auf timestamptz umgestellt, damit Datum und Anfangszeit gemeinsam
-- gespeichert werden. Bestehende Werte (nur Datum) werden verlustfrei auf Mitternacht
-- UTC interpretiert. Der CHECK-Constraint aus 051_posts_sammlung_felder.sql prüft nur
-- auf IS NOT NULL und bleibt vom Typwechsel unberührt; der partielle Index
-- idx_posts_sammlung wird von Postgres automatisch mit dem neuen Spaltentyp neu aufgebaut.

ALTER TABLE public.posts
  ALTER COLUMN sammlung_datum TYPE timestamptz USING sammlung_datum::timestamptz;
