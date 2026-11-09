-- Phase 1: Multi-Tenant – Theming und externe Links pro Gemeinde
-- Ausführen in: Supabase Dashboard → SQL Editor → New Query

-- Neue Spalten zur gemeinden-Tabelle hinzufügen
ALTER TABLE gemeinden
  ADD COLUMN IF NOT EXISTS primary_color   text DEFAULT '#0f2d6b',
  ADD COLUMN IF NOT EXISTS ratsinformation_url text;

-- Ehningen mit bestehenden Werten befüllen
UPDATE gemeinden
SET
  primary_color        = '#0f2d6b',
  ratsinformation_url  = 'https://sitzungsdienst.ehningen.de/buergerinfo/info.asp'
WHERE slug = 'ehningen';

-- Optional: Testgemeinde für lokales Testen anlegen
-- (kann danach wieder gelöscht werden)
INSERT INTO gemeinden (name, slug, bundesland, primary_color)
VALUES ('Musterstadt', 'musterstadt', 'Baden-Württemberg', '#1a7c3a')
ON CONFLICT (slug) DO NOTHING;
