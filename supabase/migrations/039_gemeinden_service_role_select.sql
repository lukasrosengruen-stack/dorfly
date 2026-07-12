-- service_role braucht SELECT auf gemeinden damit PostgREST UPDATE-Abfragen
-- ausführen kann (PATCH intern liest Zeilen zurück).
-- Migration 014 hatte INSERT/UPDATE/DELETE aber kein SELECT vergeben.
GRANT SELECT ON public.gemeinden TO service_role;
