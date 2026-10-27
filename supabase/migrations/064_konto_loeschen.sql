-- 064: Kontolöschung als eine Transaktion.
--
-- Bisher löschte /api/auth/loeschen Tabelle für Tabelle über den Service-Client
-- und prüfte keinen einzigen Fehler. Scheiterte ein Schritt, waren Inhalte schon
-- weg, das Konto bestand aber weiter. Bei Verwaltungskonten mit verschickten
-- Einladungen scheiterte die Löschung immer: einladungen.eingeladen_von
-- verweist ohne Cascade auf profiles.
--
-- Jetzt:
--   * konto_dateipfade()  liefert alle Storage-Pfade des Nutzers (nur lesend).
--     Die API-Route löscht die Dateien VOR der Datenbanklöschung, damit bei
--     einem Fehler das Konto noch existiert und der Nutzer es erneut versuchen kann.
--   * konto_loeschen()    löscht alles in einer Transaktion, inkl. auth.users.
--     Jeder Fehler bricht die gesamte Löschung ab.
--
-- Umfrageantworten werden nicht gelöscht, sondern anonymisiert: Die Stimme bleibt
-- im Ergebnis, der Bezug zum Konto entfällt (user_id = null).
--
-- Die Seite /konto-loeschen beschreibt genau dieses Verhalten. Änderungen hier
-- dort und in der Datenschutzerklärung (Ziffer 7) nachziehen.

-- ─── einladungen.eingeladen_von: Einladungen überleben das Konto ─────────────
alter table public.einladungen
  alter column eingeladen_von drop not null;

alter table public.einladungen
  drop constraint if exists einladungen_eingeladen_von_fkey;

alter table public.einladungen
  add constraint einladungen_eingeladen_von_fkey
  foreign key (eingeladen_von) references public.profiles(id) on delete set null;

-- ─── Umfrageantworten: anonymisieren statt löschen ───────────────────────────
alter table public.umfrage_antworten
  alter column user_id drop not null;

alter table public.umfrage_antworten
  drop constraint if exists umfrage_antworten_user_id_fkey;

alter table public.umfrage_antworten
  add constraint umfrage_antworten_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

alter table public.umfrage_teilnahmen
  alter column user_id drop not null;

alter table public.umfrage_teilnahmen
  drop constraint if exists umfrage_teilnahmen_user_id_fkey;

alter table public.umfrage_teilnahmen
  add constraint umfrage_teilnahmen_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

-- ─── Storage-Pfade eines Kontos ──────────────────────────────────────────────
-- Zwei Quellen:
--   1. Bild-URLs in Zeilen, die mit dem Konto gelöscht werden.
--   2. Ordner, die ausschließlich zum Konto gehören. Darüber werden auch ältere,
--      nicht mehr referenzierte Logos und Profilbilder erfasst.
-- gemeinden/ (Gemeinde-Branding) ist bewusst nicht dabei, auch wenn ein
-- Verwaltungskonto die Datei hochgeladen hat.
create or replace function public.konto_dateipfade(p_user_id uuid)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  with urls as (
    select foto_url as url from public.maengel where melder_id = p_user_id
    union all select bild_url from public.posts where author_id = p_user_id
    union all select unnest(bilder_urls) from public.posts where author_id = p_user_id
    union all select unnest(u.bilder_urls) from public.umfragen u where u.author_id = p_user_id
    union all
      select unnest(f.bilder_urls)
      from public.umfrage_fragen f
      join public.umfragen u on u.id = f.umfrage_id
      where u.author_id = p_user_id
    union all select logo_url from public.vereine where profile_id = p_user_id
    union all select logo_url from public.organisationen where profile_id = p_user_id
    union all select avatar_url from public.profiles where id = p_user_id
  ),
  aus_urls as (
    select nullif(split_part(url, '/storage/v1/object/public/dorfly-media/', 2), '') as pfad
    from urls
    where url is not null
  ),
  ordner as (
    select 'gemeinderat/' || p_user_id || '/' as praefix
    union all select 'umfragen/tmp/' || p_user_id || '/'
    union all select 'vereine/' || id || '/' from public.vereine where profile_id = p_user_id
    union all select 'gewerbe/' || id || '/' from public.organisationen where profile_id = p_user_id
    union all select 'umfragen/' || id || '/' from public.umfragen where author_id = p_user_id
  ),
  aus_ordnern as (
    select o.name as pfad
    from storage.objects o
    join ordner on starts_with(o.name, ordner.praefix)
    where o.bucket_id = 'dorfly-media'
  )
  select pfad from aus_urls where pfad is not null
  union
  select pfad from aus_ordnern
$$;

-- ─── Kontolöschung ───────────────────────────────────────────────────────────
create or replace function public.konto_loeschen(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_platzhalter constant text := 'geloeschtes-konto';
  v_emails text[];
begin
  -- Sperrt die Zeile, damit kein paralleler Aufruf dazwischenfunkt
  perform 1 from auth.users where id = p_user_id for update;
  if not found then
    raise exception 'Konto % nicht gefunden', p_user_id using errcode = 'P0002';
  end if;

  -- auth.users.email und profiles.email können auseinanderlaufen — beide erfassen
  select array_agg(distinct lower(e)) into v_emails
  from (
    select email as e from auth.users where id = p_user_id
    union all
    select email from public.profiles where id = p_user_id
  ) x
  where e is not null;

  -- Umfrageantworten anonymisieren (die Stimme zählt weiter)
  update public.umfrage_antworten set user_id = null where user_id = p_user_id;
  update public.umfrage_teilnahmen set user_id = null where user_id = p_user_id;

  -- E-Mail-Adressen in Protokoll und Einladungen durch Platzhalter ersetzen.
  -- Offene Einladungen an die Adresse werden widerrufen.
  update public.rollen_log
     set ziel_email = v_platzhalter,
         ziel_profile_id = null
   where ziel_profile_id = p_user_id
      or lower(ziel_email) = any(coalesce(v_emails, '{}'));

  update public.einladungen
     set email = v_platzhalter,
         status = case when status = 'offen' then 'widerrufen' else status end
   where lower(email) = any(coalesce(v_emails, '{}'));

  -- Inhalte löschen. Reihenfolge wegen Fremdschlüsseln ohne Cascade.
  delete from public.umfragen where author_id = p_user_id;
  delete from public.posts where author_id = p_user_id;
  delete from public.maengel where melder_id = p_user_id;
  delete from public.fragen where fragesteller_id = p_user_id;
  delete from public.gemeinderat_fragen
   where fragesteller_id = p_user_id or gemeinderat_id = p_user_id;
  delete from public.gewerbe_abonnements where user_id = p_user_id;
  delete from public.organisationen where profile_id = p_user_id;

  -- Cascade: vereine, verein_abonnements. Set null: einladungen.eingeladen_von.
  delete from public.profiles where id = p_user_id;

  -- Cascade: meldungen, abfallkalender_praeferenzen, Sessions und Identitäten
  delete from auth.users where id = p_user_id;
end;
$$;

-- ─── Grants ──────────────────────────────────────────────────────────────────
-- Nur die API-Route (service_role) darf löschen. Die user_id kommt dort aus der
-- Session, nie aus dem Request.
revoke all on function public.konto_dateipfade(uuid) from public, anon, authenticated;
revoke all on function public.konto_loeschen(uuid) from public, anon, authenticated;
grant execute on function public.konto_dateipfade(uuid) to service_role;
grant execute on function public.konto_loeschen(uuid) to service_role;

-- einladungen wird ausschließlich über service_role beschrieben (siehe 012).
-- Bisher ohne expliziten Grant — für neu aufgesetzte Projekte nachgeholt.
grant select, insert, update on public.einladungen to service_role;
