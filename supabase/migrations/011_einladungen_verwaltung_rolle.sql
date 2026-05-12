-- Erweitert die erlaubten Rollen in einladungen um 'verwaltung'
-- Damit kann der Super-Admin die ersten Verwaltungs-User einer neuen Gemeinde einladen

DO $$
DECLARE
  v_constraint text;
BEGIN
  -- Existierende Check-Constraint auf 'rolle' finden und droppen
  SELECT tc.constraint_name
    INTO v_constraint
    FROM information_schema.table_constraints tc
    JOIN information_schema.check_constraints cc
      ON tc.constraint_name = cc.constraint_name
   WHERE tc.table_schema = 'public'
     AND tc.table_name   = 'einladungen'
     AND cc.check_clause LIKE '%rolle%'
   LIMIT 1;

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.einladungen DROP CONSTRAINT %I', v_constraint);
  END IF;

  -- Neue Constraint mit 'verwaltung'
  ALTER TABLE public.einladungen
    ADD CONSTRAINT einladungen_rolle_check
    CHECK (rolle IN ('buerger', 'verein', 'organisation', 'gewerbe', 'gemeinderat', 'verwaltung'));

EXCEPTION WHEN duplicate_object THEN
  NULL; -- Constraint existiert bereits, nichts zu tun
END $$;
