-- 069: Sperre gegen doppelten Abfall-Versand
--
-- Der Abfall-Cron läuft jetzt stündlich und versendet ab 18 Uhr deutscher Zeit.
-- Vercel kann einen Lauf gelegentlich doppelt ausliefern; ohne Sperre käme die
-- Erinnerung dann zweimal. Der Cron legt vor dem Versand eine Zeile für den
-- Abfuhrtag an — der Primärschlüssel lässt je Tag nur einen Lauf durch.
--
-- Enthält keine personenbezogenen Daten, nur das Datum.

create table if not exists public.abfall_versandlaeufe (
  abfuhr_datum date primary key,
  gestartet_am timestamptz not null default now()
);

alter table public.abfall_versandlaeufe enable row level security;

-- Nur der Cron (Service-Client) schreibt und liest. Ältere Projekte vergeben per
-- Default-Privileges noch Rechte an anon/authenticated — die hier ausdrücklich entziehen.
revoke all on public.abfall_versandlaeufe from anon, authenticated;
grant select, insert, delete on public.abfall_versandlaeufe to service_role;
