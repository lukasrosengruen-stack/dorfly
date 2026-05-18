ALTER TABLE gemeinden ADD COLUMN IF NOT EXISTS homepage_url TEXT;
ALTER TABLE gemeinden ADD COLUMN IF NOT EXISTS mitteilungsblatt_url TEXT;

-- verein_name auf profiles (denormalisiert fuer Verein-/Org-Dashboard)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verein_name TEXT;
