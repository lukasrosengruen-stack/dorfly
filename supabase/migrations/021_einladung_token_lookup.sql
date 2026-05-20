-- SECURITY DEFINER-Funktion für den öffentlichen Einladungs-Token-Lookup.
-- Der GET /api/einladung/[token] Endpunkt wird ohne Session aufgerufen (anon).
-- Direkter Tabellenzugriff auf einladungen ist für anon nicht erlaubt.
-- Diese Funktion läuft mit Definer-Rechten und gibt nur die eine gesuchte Zeile zurück.

CREATE OR REPLACE FUNCTION public.get_einladung_by_token(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  IF length(p_token) < 10 THEN
    RETURN NULL;
  END IF;

  -- Abgelaufene Einladungen vorab markieren
  UPDATE public.einladungen
  SET status = 'abgelaufen'
  WHERE status = 'offen' AND ablauft_am < now();

  SELECT json_build_object(
    'email',             e.email,
    'rolle',             e.rolle,
    'organisation_name', e.organisation_name,
    'hinweis',           e.hinweis,
    'status',            e.status,
    'ablauft_am',        e.ablauft_am,
    'gemeinde_id',       e.gemeinde_id,
    'gemeinde_name',     g.name
  )
  INTO v_result
  FROM public.einladungen e
  LEFT JOIN public.gemeinden g ON g.id = e.gemeinde_id
  WHERE e.token = p_token;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_einladung_by_token(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_einladung_by_token(text) TO anon, authenticated;
