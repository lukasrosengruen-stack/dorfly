-- Erstellt einladungen- und rollen_log-Tabellen sowie die Ablauf-Funktion.
-- Diese Tabellen wurden in der alten DB manuell angelegt; hier nachgeliefert.

-- ─── einladungen ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.einladungen (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  gemeinde_id       uuid        NOT NULL REFERENCES public.gemeinden(id),
  email             text        NOT NULL,
  rolle             text        NOT NULL
    CHECK (rolle IN ('buerger', 'verein', 'organisation', 'gewerbe', 'gemeinderat', 'verwaltung')),
  organisation_name text        NULL,
  verein_id         uuid        NULL,
  org_id            uuid        NULL,
  hinweis           text        NULL,
  token             text        NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  eingeladen_von    uuid        NOT NULL REFERENCES public.profiles(id),
  erstellt_am       timestamptz NOT NULL DEFAULT now(),
  ablauft_am        timestamptz NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  angenommen_am     timestamptz NULL,
  status            text        NOT NULL DEFAULT 'offen'
    CHECK (status IN ('offen', 'angenommen', 'abgelaufen', 'widerrufen'))
);

ALTER TABLE public.einladungen ENABLE ROW LEVEL SECURITY;

-- ─── rollen_log ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rollen_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  gemeinde_id     uuid        NOT NULL REFERENCES public.gemeinden(id),
  aktion          text        NOT NULL
    CHECK (aktion IN ('eingeladen', 'rolle_gesetzt', 'rolle_transfer', 'widerrufen')),
  ziel_profile_id uuid        NULL,
  ziel_email      text        NOT NULL,
  alte_rolle      text        NULL,
  neue_rolle      text        NULL,
  einladung_id    uuid        NULL,
  ausgefuehrt_von uuid        NOT NULL,
  erstellt_am     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rollen_log ENABLE ROW LEVEL SECURITY;

-- ─── Ablauf-Funktion ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.einladungen_ablauf_aktualisieren()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.einladungen
  SET status = 'abgelaufen'
  WHERE status = 'offen'
    AND ablauft_am < now();
$$;

REVOKE EXECUTE ON FUNCTION public.einladungen_ablauf_aktualisieren() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.einladungen_ablauf_aktualisieren() TO service_role;
