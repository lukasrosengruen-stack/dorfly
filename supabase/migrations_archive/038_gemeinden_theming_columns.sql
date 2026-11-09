-- Spalten aus phase1_gemeinden_theming.sql als reguläre Migration registrieren.
-- Die Datei phase1_gemeinden_theming.sql hatte kein numerisches Präfix und wurde
-- nie via supabase db push angewendet.
ALTER TABLE gemeinden ADD COLUMN IF NOT EXISTS primary_color        text DEFAULT '#0f2d6b';
ALTER TABLE gemeinden ADD COLUMN IF NOT EXISTS ratsinformation_url  text;
