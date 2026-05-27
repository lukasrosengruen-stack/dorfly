-- Fügt 'verein' zum user_role Enum hinzu.
-- Bisher fehlte dieser Wert, wodurch eingeladene Vereinsverantwortliche
-- nach der Registrierung fälschlicherweise die Rolle 'buerger' erhielten.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.user_role'::regtype
      AND enumlabel = 'verein'
  ) THEN
    ALTER TYPE public.user_role ADD VALUE 'verein';
  END IF;
END $$;
