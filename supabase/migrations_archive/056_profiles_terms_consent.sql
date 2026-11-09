-- Consent-Nachweis für Registrierung: Zeitpunkt der Altersbestätigung (>=16) und der
-- Zustimmung zu Nutzungsbedingungen/Datenschutz, plus akzeptierte Version. NULL bei
-- Bestandsnutzern ist korrekt (sie haben nie zugestimmt) — kein Backfill.
alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version      text,
  add column if not exists age_confirmed_at   timestamptz;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.profiles to service_role;
