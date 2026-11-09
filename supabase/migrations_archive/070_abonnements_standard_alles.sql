-- 070: Standardmäßig alles abonniert
--
-- Wer neu dazukommt, soll gleich einen vollen Feed sehen und aktiv abbestellen
-- können, statt erst alles einzeln abonnieren zu müssen. Deshalb:
--   * Bekommt ein Profil eine Gemeinde, abonniert es alle Vereine, Organisationen
--     und Betriebe dieser Gemeinde.
--   * Ein neuer Verein, eine neue Organisation oder ein neuer Betrieb wird für
--     alle Nutzer der Gemeinde abonniert.
--   * Bestehende Nutzer bekommen einmalig alle Abos ihrer Gemeinde nachgetragen.
-- Abbestellen löscht wie bisher die Zeile. Die Trigger reagieren nur auf eine neue
-- Gemeinde-Zuordnung, nicht auf andere Profiländerungen — Abbestellungen bleiben.
--
-- Abos steuern nur den Feed, sie lösen keine Push-Nachrichten aus.
-- Betriebe sind organisationen mit typ = 'gewerbe' (wie auf /lokale-angebote).

-- Die Trigger legen Abos für andere Nutzer an (z. B. wenn ein Verein angelegt wird);
-- RLS erlaubt nur eigene Zeilen, daher security definer.

create or replace function public.profil_abonniert_gemeinde()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.gemeinde_id is null
     or (tg_op = 'UPDATE' and old.gemeinde_id is not distinct from new.gemeinde_id) then
    return new;
  end if;

  insert into public.verein_abonnements (user_id, verein_id)
    select new.id, v.id from public.vereine v where v.gemeinde_id = new.gemeinde_id
  on conflict (user_id, verein_id) do nothing;

  insert into public.gewerbe_abonnements (user_id, gewerbe_id)
    select new.id, o.id from public.organisationen o
     where o.gemeinde_id = new.gemeinde_id and o.typ::text = 'gewerbe'
  on conflict (user_id, gewerbe_id) do nothing;

  return new;
end;
$$;

create or replace function public.verein_fuer_gemeinde_abonnieren()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.gemeinde_id is null
     or (tg_op = 'UPDATE' and old.gemeinde_id is not distinct from new.gemeinde_id) then
    return new;
  end if;

  insert into public.verein_abonnements (user_id, verein_id)
    select p.id, new.id from public.profiles p where p.gemeinde_id = new.gemeinde_id
  on conflict (user_id, verein_id) do nothing;

  return new;
end;
$$;

create or replace function public.betrieb_fuer_gemeinde_abonnieren()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.gemeinde_id is null
     or new.typ::text <> 'gewerbe'
     or (tg_op = 'UPDATE'
         and old.gemeinde_id is not distinct from new.gemeinde_id
         and old.typ::text = new.typ::text) then
    return new;
  end if;

  insert into public.gewerbe_abonnements (user_id, gewerbe_id)
    select p.id, new.id from public.profiles p where p.gemeinde_id = new.gemeinde_id
  on conflict (user_id, gewerbe_id) do nothing;

  return new;
end;
$$;

-- Trigger-Funktionen werden nur von den Triggern aufgerufen
revoke execute on function public.profil_abonniert_gemeinde()          from public, anon, authenticated;
revoke execute on function public.verein_fuer_gemeinde_abonnieren()    from public, anon, authenticated;
revoke execute on function public.betrieb_fuer_gemeinde_abonnieren()   from public, anon, authenticated;

drop trigger if exists profil_abonniert_gemeinde on public.profiles;
create trigger profil_abonniert_gemeinde
  after insert or update of gemeinde_id on public.profiles
  for each row execute function public.profil_abonniert_gemeinde();

drop trigger if exists verein_fuer_gemeinde_abonnieren on public.vereine;
create trigger verein_fuer_gemeinde_abonnieren
  after insert or update of gemeinde_id on public.vereine
  for each row execute function public.verein_fuer_gemeinde_abonnieren();

drop trigger if exists betrieb_fuer_gemeinde_abonnieren on public.organisationen;
create trigger betrieb_fuer_gemeinde_abonnieren
  after insert or update of gemeinde_id, typ on public.organisationen
  for each row execute function public.betrieb_fuer_gemeinde_abonnieren();

-- Einmalig für alle bestehenden Nutzer nachholen
insert into public.verein_abonnements (user_id, verein_id)
  select p.id, v.id
    from public.profiles p
    join public.vereine v on v.gemeinde_id = p.gemeinde_id
on conflict (user_id, verein_id) do nothing;

insert into public.gewerbe_abonnements (user_id, gewerbe_id)
  select p.id, o.id
    from public.profiles p
    join public.organisationen o on o.gemeinde_id = p.gemeinde_id and o.typ::text = 'gewerbe'
on conflict (user_id, gewerbe_id) do nothing;
