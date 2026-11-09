-- Akzentfarbe pro Gemeinde (analog primary_color aus 038_gemeinden_theming_columns.sql).
-- Kein neues Objekt, daher keine neuen GRANTs nötig — bestehende Grants auf
-- public.gemeinden (siehe 014_profiles_phone_nullable.sql für service_role
-- INSERT/UPDATE/DELETE und 039_gemeinden_service_role_select.sql für
-- service_role SELECT) decken die neue Spalte ab.
ALTER TABLE gemeinden ADD COLUMN IF NOT EXISTS accent_color text DEFAULT '#e8a020';
