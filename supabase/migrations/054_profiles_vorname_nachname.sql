-- profiles.display_name wurde bisher im Profil-Formular naiv am Leerzeichen in
-- Vorname/Nachname gesplittet ("Dr. Andreas Schäfer" -> Vorname "Dr.", Nachname
-- "Andreas Schäfer") und beim Speichern wieder zusammengefügt. Das ist verlustbehaftet
-- bei Titeln/mehrteiligen Namen und wirkt für Nutzer so, als würde die Namensänderung
-- nicht übernommen. Echte vorname/nachname-Spalten beheben das und ermöglichen eine
-- korrekte Vorname-Begrüßung auf der Startseite. display_name bleibt bestehen, da es
-- an ~40 Lesestellen im Code genutzt wird.

alter table public.profiles
  add column if not exists vorname  text,
  add column if not exists nachname text;

-- Backfill bestehender Profile: erstes Wort = Vorname, Rest = Nachname (bestmöglich).
update public.profiles
set
  vorname  = split_part(trim(display_name), ' ', 1),
  nachname = nullif(trim(substring(trim(display_name) from length(split_part(trim(display_name), ' ', 1)) + 1)), '')
where display_name is not null
  and trim(display_name) <> ''
  and vorname is null;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.profiles to service_role;
