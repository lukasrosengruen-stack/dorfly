-- profiles.phone war fälschlicherweise NOT NULL gesetzt, obwohl die App
-- keine Telefonnummer bei der Registrierung erfordert.
-- NULL-Werte in UNIQUE-Spalten sind in PostgreSQL kein Problem (NULLs gelten nicht als gleich).
ALTER TABLE profiles ALTER COLUMN phone DROP NOT NULL;

-- service_role braucht explizite Grants in neuen Supabase-Projekten (ab Mai 2026).
GRANT INSERT, UPDATE, DELETE ON public.gemeinden TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO service_role;
