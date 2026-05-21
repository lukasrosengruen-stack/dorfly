-- Fügt 'gemeinderat' zum user_role Enum hinzu.
-- Der Wert wurde in Einladungssystem und UI verwendet, fehlte aber in der DB.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.user_role'::regtype
      AND enumlabel = 'gemeinderat'
  ) THEN
    ALTER TYPE public.user_role ADD VALUE 'gemeinderat';
  END IF;
END $$;
