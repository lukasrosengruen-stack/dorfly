-- Akzentfarbe pro Gemeinde (analog primary_color aus 038_gemeinden_theming_columns.sql).
-- Kein neues Objekt, daher keine neuen GRANTs nötig — bestehende Grants auf
-- public.gemeinden (siehe 012_explicit_grants.sql) decken die neue Spalte ab.
ALTER TABLE gemeinden ADD COLUMN IF NOT EXISTS accent_color text DEFAULT '#e8a020';
