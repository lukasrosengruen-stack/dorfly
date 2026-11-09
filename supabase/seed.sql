-- Testdaten fuer Entwicklung und lokale Datenbanken. Alle Angaben sind erfunden.
-- NIEMALS gegen die Produktion ausfuehren.
--
-- Die Testnutzer haben bewusst kein Passwort, damit keines im Repo steht. Anmeldung
-- per Magic Link oder ein Passwort im Dashboard setzen (Authentication > Users).
--
-- Mehrfach ausfuehrbar: Bestehende Zeilen bleiben unveraendert.

begin;

-- Schutz: Bricht ab, sobald die Datenbank eine andere Gemeinde als die Testgemeinde enthaelt.
do $$
begin
  if exists (select 1 from public.gemeinden where slug <> 'testdorf') then
    raise exception 'seed.sql abgebrochen: Diese Datenbank enthaelt echte Gemeinden.';
  end if;
end
$$;

insert into public.gemeinden (id, name, bundesland, einwohner, plz, slug, features, ist_oeffentlich)
values (
  '00000000-0000-4000-a000-000000000001', 'Testdorf', 'Testland', 1234, '00000', 'testdorf',
  '{"abfallkalender": true, "umfragen": true, "gemeinderat": true, "gewerbe": true, "vereine": true, "marktplatz": false, "feedback": true, "buergermeisterLabel": "buergermeister"}'::jsonb,
  true
)
on conflict (id) do nothing;

-- Je ein Testnutzer pro Rolle. Die leeren Token-Felder braucht GoTrue, NULL fuehrt dort zu Fehlern.
with nutzer(id, email) as (
  values
    ('00000000-0000-4000-a000-000000000011'::uuid, 'buerger@testdorf.invalid'),
    ('00000000-0000-4000-a000-000000000012'::uuid, 'organisation@testdorf.invalid'),
    ('00000000-0000-4000-a000-000000000013'::uuid, 'verwaltung@testdorf.invalid'),
    ('00000000-0000-4000-a000-000000000014'::uuid, 'superadmin@testdorf.invalid')
)
insert into auth.users (
  instance_id, id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000'::uuid, id, 'authenticated', 'authenticated', email, now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb, '{}'::jsonb, now(), now(),
  '', '', '', ''
from nutzer
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
select
  u.id::text, u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now()
from auth.users u
where u.id in (
  '00000000-0000-4000-a000-000000000011', '00000000-0000-4000-a000-000000000012',
  '00000000-0000-4000-a000-000000000013', '00000000-0000-4000-a000-000000000014'
)
on conflict do nothing;

insert into public.profiles (id, gemeinde_id, role, email, display_name, vorname, nachname)
values
  ('00000000-0000-4000-a000-000000000011', '00000000-0000-4000-a000-000000000001', 'buerger',      'buerger@testdorf.invalid',      'Berta Buerger',      'Berta', 'Buerger'),
  ('00000000-0000-4000-a000-000000000012', '00000000-0000-4000-a000-000000000001', 'organisation', 'organisation@testdorf.invalid', 'Olaf Organisation',  'Olaf',  'Organisation'),
  ('00000000-0000-4000-a000-000000000013', '00000000-0000-4000-a000-000000000001', 'verwaltung',   'verwaltung@testdorf.invalid',   'Vera Verwaltung',    'Vera',  'Verwaltung'),
  ('00000000-0000-4000-a000-000000000014', '00000000-0000-4000-a000-000000000001', 'super_admin',  'superadmin@testdorf.invalid',   'Sam Superadmin',     'Sam',   'Superadmin')
on conflict (id) do nothing;

insert into public.posts (id, gemeinde_id, author_id, channel, titel, inhalt, status, rejection_reason)
values
  ('00000000-0000-4000-a000-000000000021', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000013', 'gemeinde', 'Testbeitrag veroeffentlicht', 'Dieser Beitrag ist veroeffentlicht.', 'published', null),
  ('00000000-0000-4000-a000-000000000022', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000012', 'gemeinde', 'Testbeitrag in Pruefung',     'Dieser Beitrag wartet auf Freigabe.', 'pending',   null),
  ('00000000-0000-4000-a000-000000000023', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000012', 'gemeinde', 'Testbeitrag abgelehnt',       'Dieser Beitrag wurde abgelehnt.',     'rejected',  'Erfundener Ablehnungsgrund fuer Tests.')
on conflict (id) do nothing;

insert into public.maengel (id, gemeinde_id, melder_id, titel, beschreibung, adresse, lat, lng, status)
values (
  '00000000-0000-4000-a000-000000000031', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000011',
  'Testmangel Strassenlaterne', 'Die erfundene Laterne leuchtet nicht.', 'Teststrasse 1, 00000 Testdorf', 48.0, 9.0, 'offen'
)
on conflict (id) do nothing;

insert into public.fragen (id, gemeinde_id, fragesteller_id, frage, oeffentlich, status)
values (
  '00000000-0000-4000-a000-000000000041', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000011',
  'Wann wird der erfundene Spielplatz eroeffnet?', true, 'offen'
)
on conflict (id) do nothing;

commit;
