-- E-Mail-Spalte in profiles: ermöglicht direkte E-Mail-Suche ohne auth.admin.listUsers()
-- Verhindert das O(n)-Antipattern (alle 1000 User laden, einen per .find() heraussuchen).

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email)
  WHERE email IS NOT NULL;
