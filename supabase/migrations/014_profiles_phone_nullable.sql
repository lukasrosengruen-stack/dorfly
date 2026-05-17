-- profiles.phone war fälschlicherweise NOT NULL gesetzt, obwohl die App
-- keine Telefonnummer bei der Registrierung erfordert.
-- NULL-Werte in UNIQUE-Spalten sind in PostgreSQL kein Problem (NULLs gelten nicht als gleich).
ALTER TABLE profiles ALTER COLUMN phone DROP NOT NULL;

-- gemeinden: service_role braucht INSERT/UPDATE/DELETE für den Super-Admin-Dashboard-API-Endpunkt.
-- In neuen Supabase-Projekten (ab Mai 2026) keine automatischen Grants mehr.
GRANT INSERT, UPDATE, DELETE ON public.gemeinden TO service_role;
