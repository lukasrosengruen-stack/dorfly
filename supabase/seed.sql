-- Testdaten fuer Entwicklung und lokale Datenbanken. Alle Angaben sind erfunden.
-- NIEMALS gegen die Produktion ausfuehren.
--
-- Einspielen in dorfly-dev: npm run db:seed:dev (siehe supabase/README.md).
-- Das Skript ergaenzt das gemeinsame Testpasswort und die Plus-Adressen aus der
-- Umgebung an der Markierung unten. Ohne Skript (lokal per db reset) bleiben die
-- Nutzer ohne Passwort.
--
-- Mehrfach ausfuehrbar: Alle Zeilen haben feste IDs, Bestehendes bleibt erhalten.
-- Nur Termine und Enddaten werden nachgezogen, damit sie in der Zukunft bleiben.

begin;

-- Schutz: Bricht ab, sobald die Datenbank fremde Gemeinden oder deren Nutzer enthaelt.
-- Die Produktion enthaelt echte Gemeinden, dort endet der Lauf hier vor jedem Schreiben.
do $$
begin
  if exists (select 1 from public.gemeinden where slug not in ('testdorf', 'musterhausen')) then
    raise exception 'seed.sql abgebrochen: Diese Datenbank enthaelt echte Gemeinden.';
  end if;
  if exists (
    select 1 from public.profiles p
    join public.gemeinden g on g.id = p.gemeinde_id
    where g.slug not in ('testdorf', 'musterhausen')
  ) then
    raise exception 'seed.sql abgebrochen: Diese Datenbank enthaelt Nutzer echter Gemeinden.';
  end if;
end
$$;

-- Feste IDs: Gemeinde-Nr. (0 Testdorf, 1 Musterhausen, 999 uebergreifend), Datenart, laufende Nr.
create or replace function pg_temp.seed_id(gemeinde_nr int, art int, lauf int) returns uuid
language sql immutable as $$
  select format(
    '00000000-0000-4000-a%s-%s%s',
    lpad(gemeinde_nr::text, 3, '0'), lpad(art::text, 4, '0'), lpad(lauf::text, 8, '0')
  )::uuid
$$;

create temp table seed_gemeinde (
  nr int primary key, id uuid not null, slug text not null, name text not null,
  plz text not null, lat double precision not null, lng double precision not null
) on commit drop;

insert into seed_gemeinde values
  (0, '00000000-0000-4000-a000-000000000001', 'testdorf',     'Testdorf',     '00000', 48.000, 9.000),
  (1, pg_temp.seed_id(1, 0, 1),               'musterhausen', 'Musterhausen', '00001', 48.120, 9.210);

insert into public.gemeinden (id, name, bundesland, einwohner, haushalte, plz, slug, features, ist_oeffentlich, primary_color)
select id, name, 'Testland',
  case nr when 0 then 1234 else 4321 end,
  case nr when 0 then 540 else 1890 end,
  plz, slug,
  '{"abfallkalender": true, "umfragen": true, "gemeinderat": true, "gewerbe": true, "vereine": true, "marktplatz": false, "feedback": true, "buergermeisterLabel": "buergermeister"}'::jsonb,
  true,
  case nr when 0 then '#0f2d6b' else '#1f6f54' end
from seed_gemeinde
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Nutzer
-- ---------------------------------------------------------------------------

create temp table seed_nutzer (
  id uuid primary key, email text not null unique, gemeinde_nr int not null,
  role public.user_role not null, vorname text not null, nachname text not null,
  fraktion text, ueber_mich text, ist_login boolean not null default false
) on commit drop;

-- Je ein Login pro Rolle und Gemeinde. Die vier alten Testdorf-Nutzer behalten ihre IDs.
insert into seed_nutzer (id, email, gemeinde_nr, role, vorname, nachname, fraktion, ueber_mich, ist_login)
select
  case when g.nr = 0 and r.alte_id is not null then r.alte_id::uuid else pg_temp.seed_id(g.nr, 1, r.n) end,
  r.kennung || '@' || g.slug || '.invalid',
  g.nr, r.rolle::public.user_role,
  case g.nr when 0 then r.vorname_t else r.vorname_m end,
  r.nachname,
  case when r.rolle = 'gemeinderat' then 'Bürgerliste ' || g.name end,
  case when r.rolle = 'gemeinderat' then 'Seit vielen Jahren im Ort zu Hause und im Gemeinderat aktiv.' end,
  true
from seed_gemeinde g
cross join (values
  (1, 'buerger',      'buerger',      'Berta', 'Mia',    'Buerger',       '00000000-0000-4000-a000-000000000011'),
  (2, 'organisation', 'organisation', 'Olaf',  'Oskar',  'Organisation',  '00000000-0000-4000-a000-000000000012'),
  (3, 'verwaltung',   'verwaltung',   'Vera',  'Viktor', 'Verwaltung',    '00000000-0000-4000-a000-000000000013'),
  (4, 'superadmin',   'super_admin',  'Sam',   'Sina',   'Superadmin',    '00000000-0000-4000-a000-000000000014'),
  (5, 'verein',       'verein',       'Volker', 'Valerie', 'Vereinsmeier', null),
  (6, 'gewerbe',      'gewerbe',      'Gerda', 'Georg',  'Gewerblich',    null),
  (7, 'gemeinderat',  'gemeinderat',  'Rita',  'Ralf',   'Ratsmitglied',  null)
) as r(n, kennung, rolle, vorname_t, vorname_m, nachname, alte_id);

-- Sieben weitere Gemeinderaete in drei Fraktionen.
insert into seed_nutzer (id, email, gemeinde_nr, role, vorname, nachname, fraktion, ueber_mich)
select
  pg_temp.seed_id(g.nr, 3, i),
  'rat.' || i || '@' || g.slug || '.invalid',
  g.nr, 'gemeinderat',
  (array['Anton','Birgit','Claus','Doris','Emil','Frieda','Gustav'])[i],
  (array['Lindner','Hofer','Brandl','Seitz','Vogt','Reiter','Kolb'])[((i + g.nr * 3) % 7) + 1],
  case i % 3
    when 0 then 'Bürgerliste ' || g.name
    when 1 then 'Dorfgemeinschaft ' || g.name
    else 'Zukunft ' || g.name
  end,
  'Mitglied im Ausschuss für ' || (array['Bauen und Verkehr','Soziales','Finanzen','Umwelt'])[(i % 4) + 1] || '.'
from seed_gemeinde g
cross join generate_series(1, 7) as i;

-- 40 Einwohner pro Gemeinde, davon keiner mit Login.
insert into seed_nutzer (id, email, gemeinde_nr, role, vorname, nachname)
select
  pg_temp.seed_id(g.nr, 2, i),
  'einwohner.' || lpad(i::text, 3, '0') || '@' || g.slug || '.invalid',
  g.nr, 'buerger',
  (array['Anna','Ben','Carla','David','Elena','Felix','Greta','Hannes','Ida','Jonas','Klara','Leon',
         'Marie','Nico','Olivia','Paul','Rosa','Simon','Tilda','Uwe','Vanessa','Walter','Yvonne','Zoe'])
    [((i + g.nr * 7) % 24) + 1],
  (array['Müller','Schmid','Schneider','Fischer','Weber','Maier','Wagner','Becker','Schulz','Hoffmann',
         'Koch','Bauer','Richter','Klein','Wolf','Schröder','Neumann','Schwarz','Zimmermann','Braun',
         'Krüger','Hartmann','Lange','Werner','Köhler'])
    [((i * 3 + g.nr * 11) % 25) + 1]
from seed_gemeinde g
cross join generate_series(1, 40) as i;

-- Die leeren Token-Felder braucht GoTrue, NULL fuehrt dort zu Fehlern.
insert into auth.users (
  instance_id, id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000'::uuid, id, 'authenticated', 'authenticated', email, now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb, '{}'::jsonb, now(), now(),
  '', '', '', ''
from seed_nutzer
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
select
  id::text, id,
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  'email', now(), now()
from seed_nutzer
on conflict do nothing;

insert into public.profiles (id, gemeinde_id, role, email, display_name, vorname, nachname, fraktion, ueber_mich, created_at)
select
  n.id, g.id, n.role, n.email, n.vorname || ' ' || n.nachname, n.vorname, n.nachname, n.fraktion, n.ueber_mich,
  now() - make_interval(days => abs(hashtext(n.email)) % 300)
from seed_nutzer n
join seed_gemeinde g on g.nr = n.gemeinde_nr
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Vereine und Gewerbe
-- ---------------------------------------------------------------------------

insert into public.verein_kategorien (id, name, reihenfolge) values
  (pg_temp.seed_id(999, 14, 1), 'Sport', 1),
  (pg_temp.seed_id(999, 14, 2), 'Musik und Kultur', 2),
  (pg_temp.seed_id(999, 14, 3), 'Natur und Garten', 3),
  (pg_temp.seed_id(999, 14, 4), 'Soziales', 4)
on conflict (id) do nothing;

insert into public.gewerbe_branchen (id, name, reihenfolge) values
  (pg_temp.seed_id(999, 15, 1), 'Bäckerei und Lebensmittel', 1),
  (pg_temp.seed_id(999, 15, 2), 'Handwerk', 2),
  (pg_temp.seed_id(999, 15, 3), 'Gastronomie', 3)
on conflict (name) do nothing;

-- Drei Vereine und ein Eintrag vom Typ Organisation fuer das Organisations-Login.
insert into public.vereine (id, profile_id, gemeinde_id, verein_name, typ, kategorie_id, beschreibung, verified)
select
  pg_temp.seed_id(g.nr, 4, v.n),
  case v.n
    when 1 then (select id from seed_nutzer where email = 'verein@' || g.slug || '.invalid')
    when 4 then (select id from seed_nutzer where email = 'organisation@' || g.slug || '.invalid')
  end,
  g.id, replace(v.name, '{ort}', g.name), v.typ, pg_temp.seed_id(999, 14, v.kategorie),
  replace(v.beschreibung, '{ort}', g.name), true
from seed_gemeinde g
cross join (values
  (1, 'TSV {ort}',                    'verein',       1, 'Fußball, Turnen und Tischtennis für alle Altersgruppen in {ort}.'),
  (2, 'Musikverein {ort}',            'verein',       2, 'Blasmusik mit Jugendkapelle, Proben jeden Donnerstag im Bürgerhaus.'),
  (3, 'Obst- und Gartenbauverein {ort}', 'verein',    3, 'Pflege der Streuobstwiesen und Schnittkurse im Frühjahr.'),
  (4, 'Seniorenkreis {ort}',          'organisation', 4, 'Offener Treff, Ausflüge und Nachbarschaftshilfe für ältere Menschen.')
) as v(n, name, typ, kategorie, beschreibung)
on conflict (id) do nothing;

insert into public.organisationen (id, gemeinde_id, profile_id, name, typ, beschreibung, adresse, oeffnungszeiten, verified, branche_id)
select
  pg_temp.seed_id(g.nr, 5, b.n), g.id,
  case b.n when 1 then (select id from seed_nutzer where email = 'gewerbe@' || g.slug || '.invalid') end,
  b.name || ' ' || g.name, 'gewerbe', b.beschreibung,
  b.strasse || ', ' || g.plz || ' ' || g.name, b.zeiten, true,
  (select id from public.gewerbe_branchen where name = b.branche)
from seed_gemeinde g
cross join (values
  (1, 'Bäckerei Sonnenkorn', 'Handwerklich gebackenes Brot und Kuchen aus der Region.', 'Hauptstraße 5',  'Mo-Sa 6-13 Uhr',     'Bäckerei und Lebensmittel'),
  (2, 'Schreinerei Kernholz', 'Möbel nach Maß, Fenster und Innenausbau.',               'Werkstraße 14',  'Mo-Fr 8-17 Uhr',     'Handwerk'),
  (3, 'Gasthaus Zur Alten Mühle', 'Regionale Küche und Saal für Familienfeiern.',       'Mühlweg 2',      'Mi-So 11-22 Uhr',    'Gastronomie')
) as b(n, name, beschreibung, strasse, zeiten, branche)
on conflict (id) do nothing;

insert into public.mitgliedschaften (profile_id, verein_id, organisation_id, rolle, hinzugefuegt_von)
select n.id, z.verein_id, z.organisation_id, 'verwalter', v.id
from seed_gemeinde g
cross join lateral (values
  ('verein',       pg_temp.seed_id(g.nr, 4, 1), null::uuid),
  ('organisation', pg_temp.seed_id(g.nr, 4, 4), null::uuid),
  ('gewerbe',      null::uuid, pg_temp.seed_id(g.nr, 5, 1))
) as z(kennung, verein_id, organisation_id)
join seed_nutzer n on n.email = z.kennung || '@' || g.slug || '.invalid'
join seed_nutzer v on v.email = 'verwaltung@' || g.slug || '.invalid'
on conflict (profile_id) do nothing;

-- ---------------------------------------------------------------------------
-- Beitraege in allen Status
-- ---------------------------------------------------------------------------

-- Die alten Testdorf-Beitraege bleiben erhalten.
insert into public.posts (id, gemeinde_id, author_id, channel, titel, inhalt, status, rejection_reason)
values
  ('00000000-0000-4000-a000-000000000021', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000013', 'gemeinde', 'Testbeitrag veroeffentlicht', 'Dieser Beitrag ist veroeffentlicht.', 'published', null),
  ('00000000-0000-4000-a000-000000000022', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000012', 'gemeinde', 'Testbeitrag in Pruefung',     'Dieser Beitrag wartet auf Freigabe.', 'pending',   null),
  ('00000000-0000-4000-a000-000000000023', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000012', 'gemeinde', 'Testbeitrag abgelehnt',       'Dieser Beitrag wurde abgelehnt.',     'rejected',  'Erfundener Ablehnungsgrund fuer Tests.')
on conflict (id) do nothing;

insert into public.posts (
  id, gemeinde_id, author_id, org_id, channel, tag, status, titel, inhalt, rejection_reason, pinned, sichtbarkeit,
  published_at, created_at, veranstaltung_datum, veranstaltung_ort, sammlung_art, sammlung_datum, sammlung_organisator
)
select
  pg_temp.seed_id(g.nr, 6, v.n), g.id, a.id,
  case v.org when 'verein' then pg_temp.seed_id(g.nr, 4, 1) when 'gewerbe' then pg_temp.seed_id(g.nr, 5, 1) end,
  v.channel::public.post_channel, v.tag, v.status::public.post_status,
  replace(v.titel, '{ort}', g.name), replace(v.inhalt, '{ort}', g.name), v.grund, v.oben, 'alle',
  now() - make_interval(days => v.tage), now() - make_interval(days => v.tage),
  case when v.tag = 'veranstaltung' then date_trunc('hour', now()) + make_interval(days => v.termin) end,
  replace(v.ort, '{ort}', g.name),
  case when v.tag = 'sammlung' then 'altpapier' end,
  case when v.tag = 'sammlung' then date_trunc('hour', now()) + make_interval(days => v.termin) end,
  case when v.tag = 'sammlung' then 'TSV ' || g.name end
from seed_gemeinde g
cross join (values
  ( 1, 'verwaltung',  'gemeinde',    null::text, 'nachricht',         'published', 'Ortsdurchfahrt wird ab März saniert', 'Die Hauptstraße in {ort} wird in drei Bauabschnitten erneuert. Anlieger erhalten rechtzeitig ein Schreiben.', null::text, false, 3, null::int, null::text),
  ( 2, 'verwaltung',  'gemeinde',    null,       'bekanntmachung',    'published', 'Öffentliche Sitzung des Gemeinderats', 'Die nächste Sitzung findet im Rathaus statt. Die Tagesordnung hängt im Schaukasten aus.', null, false, 6, null, null),
  ( 3, 'verwaltung',  'gemeinde',    null,       'veranstaltung',     'published', 'Bürgerversammlung im Rathaus', 'Der Bürgermeister informiert über die Vorhaben des kommenden Jahres. Fragen sind ausdrücklich erwünscht.', null, false, 2, 14, 'Rathaus {ort}, Sitzungssaal'),
  ( 4, 'verwaltung',  'gemeinde',    null,       'nachricht',         'published', 'Rathaus zwischen den Feiertagen geschlossen', 'Das Rathaus {ort} bleibt vom 24. Dezember bis 6. Januar geschlossen. In Notfällen gilt die Rufnummer im Aushang.', null, true, 1, null, null),
  ( 5, 'verein',      'verein',      'verein',   'veranstaltung',     'published', 'Sommerfest auf dem Sportgelände', 'Mit Jugendturnier, Kaffee und Kuchen. Der Erlös geht an die Jugendabteilung.', null, false, 4, 30, 'Sportgelände {ort}'),
  ( 6, 'verein',      'verein',      'verein',   'nachricht',         'published', 'Neue Trainingszeiten für die Jugend', 'Ab sofort trainiert die E-Jugend dienstags und donnerstags um 17 Uhr.', null, false, 9, null, null),
  ( 7, 'verein',      'verein',      'verein',   'sammlung',          'published', 'Altpapiersammlung des TSV', 'Bitte das gebündelte Papier bis 8 Uhr gut sichtbar an die Straße legen.', null, false, 5, 10, null),
  ( 8, 'verein',      'verein',      'verein',   'nachricht',         'pending',   'Vereinsausflug an den See', 'Für den Ausflug im Juni sind noch Plätze im Bus frei. Anmeldung beim Vorstand.', null, false, 1, null, null),
  ( 9, 'verein',      'verein',      'verein',   'nachricht',         'rejected',  'Tombola mit Hauptgewinn', 'Lose gibt es ab sofort bei allen Vorstandsmitgliedern.', 'Bitte Veranstalter und Termin ergänzen.', false, 7, null, null),
  (10, 'gewerbe',     'gewerbe',     'gewerbe',  'nachricht',         'published', 'Neue Brotsorte im Angebot', 'Unser Dinkel-Saatenbrot gibt es jetzt jeden Freitag frisch aus dem Ofen.', null, false, 2, null, null),
  (11, 'gewerbe',     'gewerbe',     'gewerbe',  'nachricht',         'pending',   'Wochenangebot Kuchen', 'Diese Woche jedes zweite Stück Kuchen zum halben Preis.', null, false, 1, null, null),
  (12, 'gewerbe',     'gewerbe',     'gewerbe',  'nachricht',         'rejected',  'Sonderaktion ohne Details', 'Kommen Sie vorbei und lassen Sie sich überraschen.', 'Der Beitrag enthält keine konkrete Information.', false, 8, null, null),
  (13, 'gemeinderat', 'gemeinderat', null,       'fraktionsposition', 'published', 'Unsere Position zum neuen Baugebiet', 'Wir setzen uns für bezahlbare Grundstücke und eine sparsame Flächennutzung in {ort} ein.', null, false, 5, null, null),
  (14, 'gemeinderat', 'gemeinderat', null,       'eigene_position',   'pending',   'Mehr Sitzbänke am Dorfplatz', 'Viele ältere Menschen wünschen sich mehr Möglichkeiten zum Ausruhen. Dafür werbe ich im Rat.', null, false, 1, null, null)
) as v(n, autor, channel, org, tag, status, titel, inhalt, grund, oben, tage, termin, ort)
join seed_nutzer a on a.email = v.autor || '@' || g.slug || '.invalid'
on conflict (id) do update set
  veranstaltung_datum = excluded.veranstaltung_datum,
  sammlung_datum = excluded.sammlung_datum;

-- ---------------------------------------------------------------------------
-- Maengel in allen Status
-- ---------------------------------------------------------------------------

insert into public.maengel (id, gemeinde_id, melder_id, titel, beschreibung, adresse, lat, lng, status)
values (
  '00000000-0000-4000-a000-000000000031', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000011',
  'Testmangel Strassenlaterne', 'Die erfundene Laterne leuchtet nicht.', 'Teststrasse 1, 00000 Testdorf', 48.0, 9.0, 'offen'
)
on conflict (id) do nothing;

insert into public.maengel (id, gemeinde_id, melder_id, titel, beschreibung, adresse, lat, lng, status, nachricht_an_buerger, notiz_intern, status_updated_at, created_at)
select
  pg_temp.seed_id(g.nr, 7, m.n), g.id, pg_temp.seed_id(g.nr, 2, m.n * 3),
  m.titel, m.beschreibung, m.strasse || ', ' || g.plz || ' ' || g.name,
  g.lat + m.n * 0.001, g.lng - m.n * 0.001,
  m.status::public.maengel_status, m.nachricht, m.notiz,
  case when m.status <> 'offen' then now() - make_interval(days => m.tage - 1) end,
  now() - make_interval(days => m.tage)
from seed_gemeinde g
cross join (values
  (1, 'offen',          'Schlagloch in der Bachstraße', 'Tiefes Loch auf Höhe der Bushaltestelle, für Radfahrer gefährlich.', 'Bachstraße 8', null::text, null::text, 2),
  (2, 'offen',          'Straßenlaterne defekt', 'Die Laterne flackert seit Tagen und geht nachts aus.', 'Lindenweg 3', null, null, 3),
  (3, 'offen',          'Überquellender Mülleimer', 'Der Abfallbehälter am Spielplatz wird zu selten geleert.', 'Am Spielplatz 1', null, null, 5),
  (4, 'in_bearbeitung', 'Gehweg abgesackt', 'Mehrere Platten liegen schief, Stolpergefahr.', 'Kirchgasse 11', 'Der Bauhof hat den Schaden aufgenommen und bestellt Material.', 'Bauhof beauftragt', 9),
  (5, 'in_bearbeitung', 'Verkehrsschild verdreht', 'Das Vorfahrtsschild zeigt in die falsche Richtung.', 'Ecke Schulstraße', 'Das Schild wird in der kommenden Woche neu befestigt.', 'Termin mit Bauhof', 11),
  (6, 'in_bearbeitung', 'Wasserlache nach Regen', 'Der Einlauf scheint verstopft zu sein.', 'Talstraße 20', 'Eine Fachfirma prüft den Kanal.', 'Angebot liegt vor', 14),
  (7, 'erledigt',       'Ast auf dem Radweg', 'Nach dem Sturm liegt ein großer Ast quer.', 'Radweg am Bach', 'Der Ast wurde entfernt. Danke für den Hinweis!', 'Erledigt durch Bauhof', 20),
  (8, 'erledigt',       'Bank am Dorfplatz beschädigt', 'Eine Latte ist gebrochen.', 'Dorfplatz 1', 'Die Bank wurde repariert.', null, 25),
  (9, 'erledigt',       'Graffiti am Wartehäuschen', 'Die Rückwand ist großflächig beschmiert.', 'Bushaltestelle Mitte', 'Die Wand wurde gereinigt.', null, 31)
) as m(n, status, titel, beschreibung, strasse, nachricht, notiz, tage)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Fragen an den Buergermeister
-- ---------------------------------------------------------------------------

insert into public.fragen (id, gemeinde_id, fragesteller_id, frage, oeffentlich, status)
values (
  '00000000-0000-4000-a000-000000000041', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000011',
  'Wann wird der erfundene Spielplatz eroeffnet?', true, 'offen'
)
on conflict (id) do nothing;

insert into public.fragen (id, gemeinde_id, fragesteller_id, frage, antwort, oeffentlich, status, beantwortet_at, created_at)
select
  pg_temp.seed_id(g.nr, 8, f.n), g.id, pg_temp.seed_id(g.nr, 2, f.n * 5),
  replace(f.frage, '{ort}', g.name), replace(f.antwort, '{ort}', g.name), f.oeffentlich,
  f.status::public.frage_status,
  case when f.antwort is not null then now() - make_interval(days => f.tage - 2) end,
  now() - make_interval(days => f.tage)
from seed_gemeinde g
cross join (values
  (1, 'offen',       'Wird der Radweg nach {ort} dieses Jahr fertig?', null::text, true, 3),
  (2, 'offen',       'Gibt es Pläne für eine zweite Kinderkrippe?', null, false, 4),
  (3, 'beantwortet', 'Warum wurde die Buslinie am Wochenende gestrichen?', 'Der Landkreis hat den Fahrplan geändert. Wir setzen uns für eine Rücknahme ein.', true, 12),
  (4, 'beantwortet', 'Wann öffnet das Freibad?', 'Das Freibad öffnet voraussichtlich Mitte Mai, das Wetter gibt den genauen Termin vor.', true, 16),
  (5, 'archiviert',  'Kommt ein Geldautomat nach {ort}?', 'Die Bank hat dies leider abgelehnt. Das Thema ist vorerst abgeschlossen.', true, 40),
  (6, 'archiviert',  'Wer ist für den Winterdienst am Friedhof zuständig?', 'Zuständig ist der Bauhof, die Wege werden werktags geräumt.', false, 55)
) as f(n, status, frage, antwort, oeffentlich, tage)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Umfrage mit Teilnahmen
-- ---------------------------------------------------------------------------

insert into public.umfragen (id, gemeinde_id, author_id, titel, beschreibung, enddatum)
select
  pg_temp.seed_id(g.nr, 9, 1), g.id, a.id,
  'Wie soll der Dorfplatz in ' || g.name || ' künftig genutzt werden?',
  'Der Gemeinderat möchte vor der Planung wissen, was den Menschen im Ort wichtig ist.',
  now() + interval '30 days'
from seed_gemeinde g
join seed_nutzer a on a.email = 'verwaltung@' || g.slug || '.invalid'
on conflict (id) do update set enddatum = excluded.enddatum;

insert into public.umfrage_fragen (id, umfrage_id, reihenfolge, frage_text, typ)
select pg_temp.seed_id(g.nr, 10, f.n), pg_temp.seed_id(g.nr, 9, 1), f.n, f.frage, f.typ
from seed_gemeinde g
cross join (values
  (1, 'Soll der Dorfplatz autofrei werden?', 'ja_nein'),
  (2, 'Was wünschen Sie sich am meisten?', 'einzelauswahl'),
  (3, 'Wie zufrieden sind Sie mit dem heutigen Dorfplatz?', 'bewertung')
) as f(n, frage, typ)
on conflict (id) do nothing;

insert into public.umfrage_optionen (id, frage_id, option_text, reihenfolge)
select pg_temp.seed_id(g.nr, 11, o.n), pg_temp.seed_id(g.nr, 10, 2), o.text, o.n
from seed_gemeinde g
cross join (values (1, 'Mehr Bäume und Sitzbänke'), (2, 'Platz für einen Wochenmarkt'), (3, 'Spielgeräte für Kinder')) as o(n, text)
on conflict (id) do nothing;

insert into public.umfrage_teilnahmen (id, umfrage_id, user_id)
select pg_temp.seed_id(g.nr, 12, i), pg_temp.seed_id(g.nr, 9, 1), pg_temp.seed_id(g.nr, 2, i)
from seed_gemeinde g
cross join generate_series(1, 24) as i
on conflict do nothing;

insert into public.umfrage_antworten (id, umfrage_id, frage_id, user_id, antwort_text, option_id)
select
  pg_temp.seed_id(g.nr, 13, i * 10 + a.frage), pg_temp.seed_id(g.nr, 9, 1), pg_temp.seed_id(g.nr, 10, a.frage),
  pg_temp.seed_id(g.nr, 2, i),
  case a.frage
    when 1 then case when i % 3 = 0 then 'nein' else 'ja' end
    when 3 then ((i % 5) + 1)::text
  end,
  case a.frage when 2 then pg_temp.seed_id(g.nr, 11, (i % 3) + 1) end
from seed_gemeinde g
cross join generate_series(1, 24) as i
cross join (values (1), (2), (3)) as a(frage)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Abfalltermine
-- ---------------------------------------------------------------------------

insert into public.abfallkalender_einstellungen (gemeinde_id, verfuegbare_typen, importiert_am, importiert_von)
select id, array['restmuell_120_240', 'biomuell', 'papier_120_240', 'wertstoffe'], now(), 'seed'
from seed_gemeinde
on conflict (gemeinde_id) do nothing;

-- Fester Rhythmus ab einem Montag: Wiederholte Laeufe treffen dieselben Tage.
insert into public.abfalltermine (gemeinde_id, typ, datum)
select g.id, t.typ, d::date
from seed_gemeinde g
cross join (values
  ('restmuell_120_240', 0, 14),
  ('biomuell',          7, 14),
  ('papier_120_240',    2, 28),
  ('wertstoffe',        3, 14)
) as t(typ, versatz, rhythmus)
cross join lateral generate_series(
  date '2026-01-05' + t.versatz + g.nr,
  current_date + 182,
  make_interval(days => t.rhythmus)
) as d
where d >= current_date - 14
on conflict (gemeinde_id, typ, datum) do nothing;

-- @@SEED_GEHEIMNISSE@@

commit;
