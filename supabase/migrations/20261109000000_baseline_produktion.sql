-- Baseline: Schema der Produktion (hzptnylfdfibijkgtfhf), erzeugt mit
-- `supabase db dump` am 2026-11-08 (Schema public plus Extensions, keine Daten).
-- Die Produktion ist die massgebliche Wahrheit. Die frueheren Einzelmigrationen
-- liegen in supabase/migrations_archive und werden nicht mehr ausgefuehrt.
--
-- PostGIS wird nur per CREATE EXTENSION angelegt, seine Objekte sind nicht enthalten.
-- GRANTs fuer anon, authenticated und service_role sind unten vollstaendig enthalten.
-- Diese Datei nicht nachtraeglich aendern, Aenderungen immer als neue Migration.




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Standardrechte wie in Produktion (dort keine Eintraege in pg_default_acl).
-- Noetig, damit frische Datenbanken (lokal, Entwicklung) keine abweichenden Rechte vergeben.
-- In Produktion wird diese Baseline nur als applied markiert und nie ausgefuehrt.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant execute on functions to public;




ALTER SCHEMA "public" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "postgis" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."frage_status" AS ENUM (
    'offen',
    'beantwortet',
    'archiviert'
);


ALTER TYPE "public"."frage_status" OWNER TO "postgres";


CREATE TYPE "public"."maengel_status" AS ENUM (
    'offen',
    'in_bearbeitung',
    'erledigt'
);


ALTER TYPE "public"."maengel_status" OWNER TO "postgres";


CREATE TYPE "public"."org_type" AS ENUM (
    'verein',
    'gewerbe',
    'institution'
);


ALTER TYPE "public"."org_type" OWNER TO "postgres";


CREATE TYPE "public"."post_channel" AS ENUM (
    'gemeinde',
    'verein',
    'gewerbe',
    'gemeinderat',
    'warnung'
);


ALTER TYPE "public"."post_channel" OWNER TO "postgres";


CREATE TYPE "public"."post_status" AS ENUM (
    'pending',
    'published',
    'rejected'
);


ALTER TYPE "public"."post_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'buerger',
    'organisation',
    'verwaltung',
    'super_admin',
    'gewerbe',
    'gemeinderat',
    'verein'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_mitglied_eintragen"("p_profile_id" "uuid", "p_verein_id" "uuid", "p_organisation_id" "uuid", "p_rolle" "text", "p_akteur" "uuid", "p_jede_rolle" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  z record;
  v_alte_rolle text;
  v_gemeinde uuid;
begin
  if p_rolle is null or p_rolle not in ('verwalter', 'autor') then
    raise exception 'Unbekannte Mitgliedsrolle.' using errcode = '22023';
  end if;

  select * into z from public._vereinsziel(p_verein_id, p_organisation_id);

  select p.role::text, p.gemeinde_id
    into v_alte_rolle, v_gemeinde
    from public.profiles p
   where p.id = p_profile_id
     for update;
  if not found then
    raise exception 'Konto nicht gefunden.' using errcode = 'P0002';
  end if;

  if v_gemeinde is distinct from z.o_gemeinde_id then
    raise exception 'Diese Person gehört nicht zu dieser Gemeinde.' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.mitgliedschaften m where m.profile_id = p_profile_id)
     or (not p_jede_rolle and v_alte_rolle not in ('buerger', z.o_rolle)) then
    raise exception 'Diese Person ist bereits einem Verein zugeordnet oder hat eine andere Rolle.'
      using errcode = 'P0001';
  end if;

  insert into public.mitgliedschaften (profile_id, verein_id, organisation_id, rolle, hinzugefuegt_von)
  values (p_profile_id, p_verein_id, p_organisation_id, p_rolle, p_akteur);

  update public.profiles set role = z.o_rolle::public.user_role where id = p_profile_id;

  perform public._rollen_log(z.o_gemeinde_id, 'mitglied_hinzugefuegt', p_profile_id, v_alte_rolle, z.o_rolle, p_akteur);
end;
$$;


ALTER FUNCTION "public"."_mitglied_eintragen"("p_profile_id" "uuid", "p_verein_id" "uuid", "p_organisation_id" "uuid", "p_rolle" "text", "p_akteur" "uuid", "p_jede_rolle" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_mitglieder_recht"("p_akteur" "uuid", "p_verein_id" "uuid", "p_organisation_id" "uuid", "p_gemeinde_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select case
    when exists (
      select 1 from public.profiles p
       where p.id = p_akteur
         and (p.role::text = 'super_admin'
              or (p.role::text = 'verwaltung' and p.gemeinde_id = p_gemeinde_id))
    ) then 'verwaltung'
    when exists (
      select 1 from public.mitgliedschaften m
       where m.profile_id = p_akteur
         and m.rolle = 'verwalter'
         and (m.verein_id = p_verein_id or m.organisation_id = p_organisation_id)
    ) then 'verwalter'
  end
$$;


ALTER FUNCTION "public"."_mitglieder_recht"("p_akteur" "uuid", "p_verein_id" "uuid", "p_organisation_id" "uuid", "p_gemeinde_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_pfad_anderweitig_genutzt"("p_pfad" "text", "p_org_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    exists (
      select 1 from public.posts p
       where (p_org_id is null or p.org_id is distinct from p_org_id)
         -- Muss exakt dem entsprechen, was konto_loeschen löscht: eigene Beiträge,
         -- außer Vereins-/Gewerbebeiträge (die bleiben mit author_id = null stehen).
         and not (p_user_id is not null and p.author_id = p_user_id
                  and not (p.org_id is not null and p.channel::text in ('verein', 'gewerbe')))
         and (split_part(p.bild_url, '/storage/v1/object/public/dorfly-media/', 2) = p_pfad
              or exists (select 1 from unnest(p.bilder_urls) x
                          where split_part(x, '/storage/v1/object/public/dorfly-media/', 2) = p_pfad))
    )
    or exists (select 1 from public.vereine v
                where (p_org_id is null or v.id is distinct from p_org_id)
                  and split_part(v.logo_url, '/storage/v1/object/public/dorfly-media/', 2) = p_pfad)
    or exists (select 1 from public.organisationen o
                where (p_org_id is null or o.id is distinct from p_org_id)
                  and split_part(o.logo_url, '/storage/v1/object/public/dorfly-media/', 2) = p_pfad)
    or exists (select 1 from public.profiles pr
                where (p_user_id is null or pr.id is distinct from p_user_id)
                  and split_part(pr.avatar_url, '/storage/v1/object/public/dorfly-media/', 2) = p_pfad)
    or exists (select 1 from public.gemeinden g
                where split_part(g.logo_url, '/storage/v1/object/public/dorfly-media/', 2) = p_pfad)
    or exists (select 1 from public.maengel m
                where (p_user_id is null or m.melder_id is distinct from p_user_id)
                  and split_part(m.foto_url, '/storage/v1/object/public/dorfly-media/', 2) = p_pfad)
    or exists (select 1 from public.umfragen u
                where (p_user_id is null or u.author_id is distinct from p_user_id)
                  and exists (select 1 from unnest(u.bilder_urls) x
                               where split_part(x, '/storage/v1/object/public/dorfly-media/', 2) = p_pfad))
    or exists (select 1 from public.umfrage_fragen f
                join public.umfragen u on u.id = f.umfrage_id
                where (p_user_id is null or u.author_id is distinct from p_user_id)
                  and exists (select 1 from unnest(f.bilder_urls) x
                               where split_part(x, '/storage/v1/object/public/dorfly-media/', 2) = p_pfad))
$$;


ALTER FUNCTION "public"."_pfad_anderweitig_genutzt"("p_pfad" "text", "p_org_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_rollen_log"("p_gemeinde_id" "uuid", "p_aktion" "text", "p_profile_id" "uuid", "p_alte" "text", "p_neue" "text", "p_akteur" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  insert into public.rollen_log
    (gemeinde_id, aktion, ziel_profile_id, ziel_email, alte_rolle, neue_rolle, ausgefuehrt_von)
  select p_gemeinde_id, p_aktion, p.id, coalesce(p.email, ''), p_alte, p_neue, coalesce(p_akteur, p.id)
    from public.profiles p
   where p.id = p_profile_id
$$;


ALTER FUNCTION "public"."_rollen_log"("p_gemeinde_id" "uuid", "p_aktion" "text", "p_profile_id" "uuid", "p_alte" "text", "p_neue" "text", "p_akteur" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_vereinszeile_anlegen"("p_typ" "text", "p_gemeinde_id" "uuid", "p_name" "text", "p_profile_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_id uuid;
begin
  if p_typ = 'gewerbe' then
    insert into public.organisationen (gemeinde_id, profile_id, name, typ)
    values (p_gemeinde_id, p_profile_id, p_name, 'gewerbe')
    returning id into v_id;
  elsif p_typ in ('verein', 'organisation') then
    insert into public.vereine (gemeinde_id, profile_id, verein_name, typ)
    values (p_gemeinde_id, p_profile_id, p_name, p_typ)
    returning id into v_id;
  else
    raise exception 'Unbekannter Typ %.', p_typ using errcode = '22023';
  end if;
  return v_id;
end;
$$;


ALTER FUNCTION "public"."_vereinszeile_anlegen"("p_typ" "text", "p_gemeinde_id" "uuid", "p_name" "text", "p_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_vereinsziel"("p_verein_id" "uuid", "p_organisation_id" "uuid", OUT "o_gemeinde_id" "uuid", OUT "o_rolle" "text", OUT "o_name" "text") RETURNS "record"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if num_nonnulls(p_verein_id, p_organisation_id) <> 1 then
    raise exception 'Bitte genau einen Verein oder ein Gewerbe angeben.' using errcode = '22023';
  end if;

  if p_verein_id is not null then
    select v.gemeinde_id, v.typ, v.verein_name
      into o_gemeinde_id, o_rolle, o_name
      from public.vereine v
     where v.id = p_verein_id
       for no key update;
  else
    select o.gemeinde_id, 'gewerbe', o.name
      into o_gemeinde_id, o_rolle, o_name
      from public.organisationen o
     where o.id = p_organisation_id
       for no key update;
  end if;

  if o_rolle is null then
    raise exception 'Verein oder Gewerbe nicht gefunden.' using errcode = 'P0002';
  end if;
end;
$$;


ALTER FUNCTION "public"."_vereinsziel"("p_verein_id" "uuid", "p_organisation_id" "uuid", OUT "o_gemeinde_id" "uuid", OUT "o_rolle" "text", OUT "o_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_weiterer_verwalter"("p_verein_id" "uuid", "p_organisation_id" "uuid", "p_ohne" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1 from public.mitgliedschaften m
     where m.profile_id <> p_ohne
       and m.rolle = 'verwalter'
       and (m.verein_id = p_verein_id or m.organisation_id = p_organisation_id)
  )
$$;


ALTER FUNCTION "public"."_weiterer_verwalter"("p_verein_id" "uuid", "p_organisation_id" "uuid", "p_ohne" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."betrieb_fuer_gemeinde_abonnieren"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."betrieb_fuer_gemeinde_abonnieren"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_gemeinde_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  select gemeinde_id from public.profiles where id = auth.uid()
$$;


ALTER FUNCTION "public"."current_gemeinde_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."einladung_einloesen"("p_profile_id" "uuid", "p_einladung_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  e record;
  z record;
  v_email text;
  v_id uuid;
begin
  select * into e from public.einladungen where id = p_einladung_id;
  if not found then
    raise exception 'Einladung nicht gefunden.' using errcode = 'P0002';
  end if;

  select p.email into v_email from public.profiles p where p.id = p_profile_id;
  if lower(coalesce(v_email, '')) <> lower(e.email) then
    raise exception 'Diese Einladung ist für eine andere E-Mail-Adresse ausgestellt.' using errcode = '42501';
  end if;
  -- profilAnlegen setzt angenommen_am unmittelbar vorher; das Zeitfenster verhindert,
  -- dass eine alte, schon angenommene Einladung später erneut eingelöst wird.
  if e.status <> 'angenommen'
     or e.angenommen_am is null
     or e.angenommen_am <= now() - interval '1 hour' then
    raise exception 'Die Einladung wurde nicht angenommen.' using errcode = 'P0001';
  end if;

  if e.rolle not in ('verein', 'organisation', 'gewerbe') then
    return;
  end if;

  if e.verein_id is not null or e.org_id is not null then
    select * into z from public._vereinsziel(e.verein_id, e.org_id);
    if public._mitglieder_recht(e.eingeladen_von, e.verein_id, e.org_id, z.o_gemeinde_id) is null then
      raise exception 'Die einladende Person ist nicht mehr berechtigt.' using errcode = '42501';
    end if;
    perform public._mitglied_eintragen(
      p_profile_id, e.verein_id, e.org_id, coalesce(e.mitglied_rolle, 'autor'), e.eingeladen_von, false);
  elsif coalesce(btrim(e.organisation_name), '') <> '' then
    v_id := public._vereinszeile_anlegen(e.rolle, e.gemeinde_id, btrim(e.organisation_name), p_profile_id);
    if e.rolle = 'gewerbe' then
      perform public._mitglied_eintragen(p_profile_id, null, v_id, 'verwalter', e.eingeladen_von, false);
    else
      perform public._mitglied_eintragen(p_profile_id, v_id, null, 'verwalter', e.eingeladen_von, false);
    end if;
  end if;
end;
$$;


ALTER FUNCTION "public"."einladung_einloesen"("p_profile_id" "uuid", "p_einladung_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."einladungen_ablauf_aktualisieren"() RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  UPDATE public.einladungen
  SET status = 'abgelaufen'
  WHERE status = 'offen'
    AND ablauft_am < now();
$$;


ALTER FUNCTION "public"."einladungen_ablauf_aktualisieren"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_einladung_by_token"("p_token" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_einladung_by_token"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_super_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'super_admin'::user_role
  )
$$;


ALTER FUNCTION "public"."is_super_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_verwaltung"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('verwaltung'::user_role, 'super_admin'::user_role)
  )
$$;


ALTER FUNCTION "public"."is_verwaltung"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."konto_dateipfade"("p_user_id" "uuid") RETURNS SETOF "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with urls as (
    select foto_url as url from public.maengel where melder_id = p_user_id
    union all
      select bild_url from public.posts
      where author_id = p_user_id and not (org_id is not null and channel::text in ('verein', 'gewerbe'))
    union all
      select unnest(bilder_urls) from public.posts
      where author_id = p_user_id and not (org_id is not null and channel::text in ('verein', 'gewerbe'))
    union all select unnest(u.bilder_urls) from public.umfragen u where u.author_id = p_user_id
    union all
      select unnest(f.bilder_urls)
      from public.umfrage_fragen f
      join public.umfragen u on u.id = f.umfrage_id
      where u.author_id = p_user_id
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
    union all select 'umfragen/' || id || '/' from public.umfragen where author_id = p_user_id
  ),
  aus_ordnern as (
    select o.name as pfad
    from storage.objects o
    join ordner on starts_with(o.name, ordner.praefix)
    where o.bucket_id = 'dorfly-media'
  ),
  kandidaten as (
    select pfad from aus_urls where pfad is not null
    union
    select pfad from aus_ordnern
  )
  select k.pfad
    from kandidaten k
   where not public._pfad_anderweitig_genutzt(k.pfad, null, p_user_id)
     and not starts_with(k.pfad, 'gemeinden/')
     and position('..' in k.pfad) = 0
     and position('?' in k.pfad) = 0
$$;


ALTER FUNCTION "public"."konto_dateipfade"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."konto_loeschen"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_platzhalter constant text := 'geloeschtes-konto';
  v_emails text[];
begin
  perform 1 from auth.users where id = p_user_id for update;
  if not found then
    raise exception 'Konto % nicht gefunden', p_user_id using errcode = 'P0002';
  end if;

  select array_agg(distinct lower(e)) into v_emails
  from (
    select email as e from auth.users where id = p_user_id
    union all
    select email from public.profiles where id = p_user_id
  ) x
  where e is not null;

  update public.umfrage_antworten set user_id = null where user_id = p_user_id;
  update public.umfrage_teilnahmen set user_id = null where user_id = p_user_id;

  update public.rollen_log
     set ziel_email = v_platzhalter,
         ziel_profile_id = null
   where ziel_profile_id = p_user_id
      or lower(ziel_email) = any(coalesce(v_emails, '{}'));

  update public.einladungen
     set email = v_platzhalter,
         status = case when status = 'offen' then 'widerrufen' else status end
   where lower(email) = any(coalesce(v_emails, '{}'));

  -- Vereins- und Gewerbebeiträge gehören dem Verein: bleiben, ohne Autor.
  -- Löschregel für Beiträge: identisch in konto_dateipfade und
  -- _pfad_anderweitig_genutzt (p_user_id) — bei Änderungen alle Stellen anpassen.
  update public.posts
     set author_id = null
   where author_id = p_user_id
     and org_id is not null
     and channel::text in ('verein', 'gewerbe');

  delete from public.umfragen where author_id = p_user_id;
  delete from public.posts where author_id = p_user_id;
  delete from public.maengel where melder_id = p_user_id;
  delete from public.fragen where fragesteller_id = p_user_id;
  delete from public.gemeinderat_fragen
   where fragesteller_id = p_user_id or gemeinderat_id = p_user_id;
  delete from public.gewerbe_abonnements where user_id = p_user_id;

  -- Cascade: mitgliedschaften, verein_abonnements.
  -- Set null: vereine.profile_id, organisationen.profile_id, einladungen.eingeladen_von,
  --           mitgliedschaften.hinzugefuegt_von.
  delete from public.profiles where id = p_user_id;

  -- Cascade: meldungen, abfallkalender_praeferenzen, Sessions und Identitäten
  delete from auth.users where id = p_user_id;
end;
$$;


ALTER FUNCTION "public"."konto_loeschen"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mitglied_entfernen"("p_profile_id" "uuid", "p_ausgefuehrt_von" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  m record;
  z record;
  v_recht text;
  v_verein_id uuid;
  v_organisation_id uuid;
begin
  select * into m from public.mitgliedschaften where profile_id = p_profile_id;
  if not found then
    raise exception 'Diese Person ist kein Mitglied.' using errcode = 'P0002';
  end if;
  v_verein_id := m.verein_id;
  v_organisation_id := m.organisation_id;

  -- Sperrreihenfolge überall gleich: Ziel -> Profil -> Mitgliedschaft (wie
  -- _mitglied_eintragen), sonst drohen Deadlocks. Parallele Aufrufe für denselben
  -- Verein sehen so die Verwalter-Anzahl nacheinander.
  select * into z from public._vereinsziel(m.verein_id, m.organisation_id);
  perform 1 from public.profiles where id = p_profile_id for update;
  select * into m from public.mitgliedschaften where profile_id = p_profile_id for update;
  if not found then
    raise exception 'Diese Person ist kein Mitglied.' using errcode = 'P0002';
  end if;
  if m.verein_id is distinct from v_verein_id or m.organisation_id is distinct from v_organisation_id then
    raise exception 'Die Mitgliedschaft hat sich gerade geändert. Bitte erneut versuchen.' using errcode = 'P0001';
  end if;

  v_recht := public._mitglieder_recht(p_ausgefuehrt_von, m.verein_id, m.organisation_id, z.o_gemeinde_id);
  if v_recht is null and p_ausgefuehrt_von is distinct from p_profile_id then
    raise exception 'Keine Berechtigung.' using errcode = '42501';
  end if;

  if m.rolle = 'verwalter'
     and v_recht is distinct from 'verwaltung'
     and not public._weiterer_verwalter(m.verein_id, m.organisation_id, p_profile_id) then
    raise exception 'Der letzte Verwalter kann nicht entfernt werden. Lege zuerst eine andere Person als Verwalter fest.'
      using errcode = 'P0001';
  end if;

  delete from public.mitgliedschaften where profile_id = p_profile_id;
  update public.profiles set role = 'buerger' where id = p_profile_id;

  perform public._rollen_log(z.o_gemeinde_id, 'mitglied_entfernt', p_profile_id, z.o_rolle, 'buerger', p_ausgefuehrt_von);
end;
$$;


ALTER FUNCTION "public"."mitglied_entfernen"("p_profile_id" "uuid", "p_ausgefuehrt_von" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mitglied_hinzufuegen"("p_profile_id" "uuid", "p_rolle" "text", "p_ausgefuehrt_von" "uuid", "p_verein_id" "uuid" DEFAULT NULL::"uuid", "p_organisation_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  z record;
begin
  if p_rolle is null or p_rolle not in ('verwalter', 'autor') then
    raise exception 'Unbekannte Mitgliedsrolle.' using errcode = '22023';
  end if;

  select * into z from public._vereinsziel(p_verein_id, p_organisation_id);

  if public._mitglieder_recht(p_ausgefuehrt_von, p_verein_id, p_organisation_id, z.o_gemeinde_id) is null then
    raise exception 'Keine Berechtigung.' using errcode = '42501';
  end if;

  perform public._mitglied_eintragen(p_profile_id, p_verein_id, p_organisation_id, p_rolle, p_ausgefuehrt_von, false);
end;
$$;


ALTER FUNCTION "public"."mitglied_hinzufuegen"("p_profile_id" "uuid", "p_rolle" "text", "p_ausgefuehrt_von" "uuid", "p_verein_id" "uuid", "p_organisation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mitglied_rolle_aendern"("p_profile_id" "uuid", "p_rolle" "text", "p_ausgefuehrt_von" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  m record;
  z record;
  v_recht text;
  v_verein_id uuid;
  v_organisation_id uuid;
begin
  if p_rolle is null or p_rolle not in ('verwalter', 'autor') then
    raise exception 'Unbekannte Mitgliedsrolle.' using errcode = '22023';
  end if;

  select * into m from public.mitgliedschaften where profile_id = p_profile_id;
  if not found then
    raise exception 'Diese Person ist kein Mitglied.' using errcode = 'P0002';
  end if;
  v_verein_id := m.verein_id;
  v_organisation_id := m.organisation_id;

  -- Sperrreihenfolge: Ziel -> Profil -> Mitgliedschaft (siehe mitglied_entfernen).
  select * into z from public._vereinsziel(m.verein_id, m.organisation_id);
  perform 1 from public.profiles where id = p_profile_id for update;
  select * into m from public.mitgliedschaften where profile_id = p_profile_id for update;
  if not found then
    raise exception 'Diese Person ist kein Mitglied.' using errcode = 'P0002';
  end if;
  if m.verein_id is distinct from v_verein_id or m.organisation_id is distinct from v_organisation_id then
    raise exception 'Die Mitgliedschaft hat sich gerade geändert. Bitte erneut versuchen.' using errcode = 'P0001';
  end if;

  v_recht := public._mitglieder_recht(p_ausgefuehrt_von, m.verein_id, m.organisation_id, z.o_gemeinde_id);
  if v_recht is null then
    raise exception 'Keine Berechtigung.' using errcode = '42501';
  end if;

  if m.rolle = p_rolle then
    return;
  end if;

  if m.rolle = 'verwalter'
     and v_recht is distinct from 'verwaltung'
     and not public._weiterer_verwalter(m.verein_id, m.organisation_id, p_profile_id) then
    raise exception 'Der letzte Verwalter kann nicht herabgestuft werden. Lege zuerst eine andere Person als Verwalter fest.'
      using errcode = 'P0001';
  end if;

  update public.mitgliedschaften set rolle = p_rolle where profile_id = p_profile_id;

  perform public._rollen_log(z.o_gemeinde_id, 'mitglied_rolle_geaendert', p_profile_id, m.rolle, p_rolle, p_ausgefuehrt_von);
end;
$$;


ALTER FUNCTION "public"."mitglied_rolle_aendern"("p_profile_id" "uuid", "p_rolle" "text", "p_ausgefuehrt_von" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."profil_abonniert_gemeinde"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."profil_abonniert_gemeinde"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at = now(); return new; end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."superadmin_buerger_stats"("p_gemeinde_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
  SELECT json_build_object(
    'total',               COUNT(*),
    'mau',                 COUNT(*) FILTER (WHERE u.last_sign_in_at > NOW() - INTERVAL '30 days'),
    'retention_eligible',  COUNT(*) FILTER (WHERE u.created_at < NOW() - INTERVAL '30 days'),
    'retention_active',    COUNT(*) FILTER (
                             WHERE u.created_at < NOW() - INTERVAL '30 days'
                               AND u.last_sign_in_at > NOW() - INTERVAL '30 days'
                           )
  )
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.role::text = 'buerger'
    AND (p_gemeinde_id IS NULL OR p.gemeinde_id = p_gemeinde_id);
$$;


ALTER FUNCTION "public"."superadmin_buerger_stats"("p_gemeinde_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."superadmin_maengel_stats"("p_gemeinde_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT json_build_object(
    'total',          COUNT(*),
    'erledigt',       COUNT(*) FILTER (WHERE status::text = 'erledigt'),
    'in_bearbeitung', COUNT(*) FILTER (WHERE status::text = 'in_bearbeitung'),
    'offen',          COUNT(*) FILTER (WHERE status::text = 'offen')
  )
  FROM public.maengel
  WHERE (p_gemeinde_id IS NULL OR gemeinde_id = p_gemeinde_id);
$$;


ALTER FUNCTION "public"."superadmin_maengel_stats"("p_gemeinde_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."superadmin_posts_stats"("p_gemeinde_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT json_build_object(
    'posts_7d',  COUNT(*) FILTER (WHERE published_at > NOW() - INTERVAL '7 days'),
    'posts_30d', COUNT(*) FILTER (WHERE published_at > NOW() - INTERVAL '30 days')
  )
  FROM public.posts
  WHERE status::text = 'published'
    AND (p_gemeinde_id IS NULL OR gemeinde_id = p_gemeinde_id);
$$;


ALTER FUNCTION "public"."superadmin_posts_stats"("p_gemeinde_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."superadmin_produzentenaccounts"("p_rolle" "text", "p_gemeinde_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with veroeffentlicht as (
    select author_id, org_id, channel::text as channel,
           published_at > now() - interval '7 days'  as in_7d,
           published_at > now() - interval '30 days' as in_30d
      from public.posts
     where status::text = 'published'
       and (p_gemeinde_id is null or gemeinde_id = p_gemeinde_id)
  ),
  ziel_posts as (
    select org_id, count(*) filter (where in_7d) as cnt_7d, count(*) filter (where in_30d) as cnt_30d
      from veroeffentlicht
     where org_id is not null and channel in ('verein', 'gewerbe')
     group by org_id
  ),
  person_posts as (
    select author_id, count(*) filter (where in_7d) as cnt_7d, count(*) filter (where in_30d) as cnt_30d
      from veroeffentlicht
     group by author_id
  ),
  ziele as (
    select v.id, v.verein_name as name, v.created_at,
           (select count(*) from public.verein_abonnements va where va.verein_id = v.id) as subs
      from public.vereine v
     where p_rolle in ('verein', 'organisation')
       and v.typ = p_rolle
       and (p_gemeinde_id is null or v.gemeinde_id = p_gemeinde_id)
    union all
    select o.id, o.name, o.created_at,
           (select count(*) from public.gewerbe_abonnements ga where ga.gewerbe_id = o.id)
      from public.organisationen o
     where p_rolle = 'gewerbe'
       and o.typ::text = 'gewerbe'
       and (p_gemeinde_id is null or o.gemeinde_id = p_gemeinde_id)
  ),
  zeilen as (
    select z.id, z.name, coalesce(zp.cnt_7d, 0) as p7, coalesce(zp.cnt_30d, 0) as p30,
           z.subs::int as subs, z.created_at
      from ziele z
      left join ziel_posts zp on zp.org_id = z.id
    union all
    select p.id, p.display_name, coalesce(pp.cnt_7d, 0), coalesce(pp.cnt_30d, 0),
           null::int, p.created_at
      from public.profiles p
      left join person_posts pp on pp.author_id = p.id
     where p_rolle not in ('verein', 'organisation', 'gewerbe')
       and p.role::text = p_rolle
       and (p_gemeinde_id is null or p.gemeinde_id = p_gemeinde_id)
  )
  select coalesce(json_agg(
    json_build_object(
      'id',          id,
      'name',        coalesce(nullif(trim(coalesce(name, '')), ''), '–'),
      'posts_7d',    p7,
      'posts_30d',   p30,
      'subscribers', subs,
      'is_active',   p30 > 0
    )
    order by p30 desc, created_at
  ), '[]'::json)
  from zeilen
$$;


ALTER FUNCTION "public"."superadmin_produzentenaccounts"("p_rolle" "text", "p_gemeinde_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."superadmin_rollen_stats"("p_gemeinde_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH post_counts AS (
    SELECT
      author_id,
      COUNT(*) FILTER (WHERE published_at > NOW() - INTERVAL '7 days')  AS cnt_7d,
      COUNT(*) FILTER (WHERE published_at > NOW() - INTERVAL '30 days') AS cnt_30d
    FROM public.posts
    WHERE status::text = 'published'
      AND (p_gemeinde_id IS NULL OR gemeinde_id = p_gemeinde_id)
    GROUP BY author_id
  )
  SELECT COALESCE(json_agg(stats), '[]'::json)
  FROM (
    SELECT
      p.role::text                                                           AS role,
      COUNT(DISTINCT p.id)                                                   AS account_count,
      COALESCE(SUM(pc.cnt_7d),  0)                                          AS posts_7d,
      COALESCE(SUM(pc.cnt_30d), 0)                                          AS posts_30d,
      COUNT(DISTINCT CASE WHEN COALESCE(pc.cnt_30d, 0) > 0 THEN p.id END)  AS active_30d
    FROM public.profiles p
    LEFT JOIN post_counts pc ON pc.author_id = p.id
    WHERE p.role::text IN ('verwaltung', 'verein', 'organisation', 'gewerbe', 'gemeinderat')
      AND (p_gemeinde_id IS NULL OR p.gemeinde_id = p_gemeinde_id)
    GROUP BY p.role
  ) stats;
$$;


ALTER FUNCTION "public"."superadmin_rollen_stats"("p_gemeinde_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."umfrage_ergebnisse"("p_umfrage_id" "uuid") RETURNS TABLE("frage_id" "uuid", "option_id" "uuid", "antwort_text" "text", "anzahl" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  select
    a.frage_id,
    a.option_id,
    a.antwort_text,
    count(*) as anzahl
  from public.umfrage_antworten a
  join public.umfragen u on u.id = a.umfrage_id
  where a.umfrage_id = p_umfrage_id
    and u.gemeinde_id = public.current_gemeinde_id()
    and public.is_verwaltung()
  group by a.frage_id, a.option_id, a.antwort_text
$$;


ALTER FUNCTION "public"."umfrage_ergebnisse"("p_umfrage_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."umfrage_teilnehmer_anzahl"("p_umfrage_id" "uuid") RETURNS bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  select count(*)
  from public.umfrage_teilnahmen t
  join public.umfragen u on u.id = t.umfrage_id
  where t.umfrage_id = p_umfrage_id
    and u.gemeinde_id = public.current_gemeinde_id()
    and public.is_verwaltung()
$$;


ALTER FUNCTION "public"."umfrage_teilnehmer_anzahl"("p_umfrage_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."umfrage_teilnehmer_anzahlen"() RETURNS TABLE("umfrage_id" "uuid", "anzahl" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  select t.umfrage_id, count(*) as anzahl
  from public.umfrage_teilnahmen t
  join public.umfragen u on u.id = t.umfrage_id
  where u.gemeinde_id = public.current_gemeinde_id()
    and public.is_verwaltung()
  group by t.umfrage_id
$$;


ALTER FUNCTION "public"."umfrage_teilnehmer_anzahlen"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verein_anlegen"("p_profile_id" "uuid", "p_typ" "text", "p_name" "text", "p_ausgefuehrt_von" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_rolle text;
  v_gemeinde uuid;
  v_akteur_rolle text;
  v_akteur_gemeinde uuid;
  v_jede_rolle boolean;
  v_id uuid;
begin
  if p_typ not in ('verein', 'organisation', 'gewerbe') then
    raise exception 'Unbekannter Typ %.', p_typ using errcode = '22023';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'Bitte einen Namen angeben.' using errcode = '22023';
  end if;

  -- Das Ziel entsteht erst unten in dieser Transaktion, die Sperrreihenfolge
  -- Ziel -> Profil -> Mitgliedschaft ist deshalb nicht verletzt.
  select p.role::text, p.gemeinde_id into v_rolle, v_gemeinde
    from public.profiles p where p.id = p_profile_id for update;
  if not found then
    raise exception 'Konto nicht gefunden.' using errcode = 'P0002';
  end if;
  if v_gemeinde is null then
    raise exception 'Diese Person ist keiner Gemeinde zugeordnet.' using errcode = 'P0001';
  end if;
  if v_rolle in ('verwaltung', 'super_admin') then
    raise exception 'Konten der Verwaltung können keinem Verein zugeordnet werden.' using errcode = 'P0001';
  end if;

  select p.role::text, p.gemeinde_id into v_akteur_rolle, v_akteur_gemeinde
    from public.profiles p where p.id = p_ausgefuehrt_von;

  if v_akteur_rolle = 'super_admin'
     or (v_akteur_rolle = 'verwaltung' and v_akteur_gemeinde = v_gemeinde) then
    v_jede_rolle := true;
  elsif p_ausgefuehrt_von = p_profile_id and v_rolle = p_typ then
    v_jede_rolle := false;
  else
    raise exception 'Keine Berechtigung.' using errcode = '42501';
  end if;

  if exists (select 1 from public.mitgliedschaften m where m.profile_id = p_profile_id) then
    raise exception 'Diese Person ist bereits einem Verein zugeordnet oder hat eine andere Rolle.'
      using errcode = 'P0001';
  end if;

  v_id := public._vereinszeile_anlegen(p_typ, v_gemeinde, btrim(p_name), p_profile_id);

  if p_typ = 'gewerbe' then
    perform public._mitglied_eintragen(p_profile_id, null, v_id, 'verwalter', p_ausgefuehrt_von, v_jede_rolle);
  else
    perform public._mitglied_eintragen(p_profile_id, v_id, null, 'verwalter', p_ausgefuehrt_von, v_jede_rolle);
  end if;

  return v_id;
end;
$$;


ALTER FUNCTION "public"."verein_anlegen"("p_profile_id" "uuid", "p_typ" "text", "p_name" "text", "p_ausgefuehrt_von" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verein_dateipfade"("p_verein_id" "uuid" DEFAULT NULL::"uuid", "p_organisation_id" "uuid" DEFAULT NULL::"uuid") RETURNS SETOF "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with urls as (
    select logo_url as url from public.vereine where id = p_verein_id
    union all select logo_url from public.organisationen where id = p_organisation_id
    union all select bild_url from public.posts where org_id = coalesce(p_verein_id, p_organisation_id)
    union all select unnest(bilder_urls) from public.posts where org_id = coalesce(p_verein_id, p_organisation_id)
  ),
  aus_urls as (
    select nullif(split_part(url, '/storage/v1/object/public/dorfly-media/', 2), '') as pfad
    from urls
    where url is not null
  ),
  ordner as (
    select 'vereine/' || p_verein_id || '/' as praefix where p_verein_id is not null
    union all select 'gewerbe/' || p_organisation_id || '/' where p_organisation_id is not null
  ),
  aus_ordnern as (
    select o.name as pfad
    from storage.objects o
    join ordner on starts_with(o.name, ordner.praefix)
    where o.bucket_id = 'dorfly-media'
  ),
  kandidaten as (
    select pfad from aus_urls where pfad is not null
    union
    select pfad from aus_ordnern
  )
  select k.pfad
    from kandidaten k
   where (starts_with(k.pfad, 'posts/')
          or starts_with(k.pfad, 'vereine/neu/')
          or (p_verein_id is not null and starts_with(k.pfad, 'vereine/' || p_verein_id || '/'))
          or (p_organisation_id is not null and starts_with(k.pfad, 'gewerbe/' || p_organisation_id || '/')))
     and position('..' in k.pfad) = 0
     and position('?' in k.pfad) = 0
     and not public._pfad_anderweitig_genutzt(k.pfad, coalesce(p_verein_id, p_organisation_id), null)
$$;


ALTER FUNCTION "public"."verein_dateipfade"("p_verein_id" "uuid", "p_organisation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verein_fuer_gemeinde_abonnieren"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."verein_fuer_gemeinde_abonnieren"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verein_loeschen"("p_ausgefuehrt_von" "uuid", "p_verein_id" "uuid" DEFAULT NULL::"uuid", "p_organisation_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("mitglied_id" "uuid", "mitglied_email" "text", "mitglied_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  z record;
  v_ziel uuid := coalesce(p_verein_id, p_organisation_id);
begin
  select * into z from public._vereinsziel(p_verein_id, p_organisation_id);

  if public._mitglieder_recht(p_ausgefuehrt_von, p_verein_id, p_organisation_id, z.o_gemeinde_id) is null then
    raise exception 'Keine Berechtigung.' using errcode = '42501';
  end if;

  return query
    select m.profile_id, p.email, p.display_name
      from public.mitgliedschaften m
      join public.profiles p on p.id = m.profile_id
     where (m.verein_id = p_verein_id or m.organisation_id = p_organisation_id)
       and m.profile_id is distinct from p_ausgefuehrt_von;

  -- posts.org_id hat keinen Fremdschlüssel (033) — ausdrücklich löschen.
  -- post_termine hängt per Cascade dran.
  delete from public.posts where org_id = v_ziel;

  perform public._rollen_log(z.o_gemeinde_id, 'verein_geloescht', m.profile_id, z.o_rolle, 'buerger', p_ausgefuehrt_von)
     from public.mitgliedschaften m
    where m.verein_id = p_verein_id or m.organisation_id = p_organisation_id;

  update public.profiles p
     set role = 'buerger'
    from public.mitgliedschaften m
   where m.profile_id = p.id
     and (m.verein_id = p_verein_id or m.organisation_id = p_organisation_id);

  update public.einladungen
     set status = 'widerrufen'
   where status = 'offen'
     and (verein_id = p_verein_id or org_id = p_organisation_id);

  -- Cascade: Abonnements, Mitgliedschaften
  if p_verein_id is not null then
    delete from public.vereine where id = p_verein_id;
  else
    delete from public.organisationen where id = p_organisation_id;
  end if;
end;
$$;


ALTER FUNCTION "public"."verein_loeschen"("p_ausgefuehrt_von" "uuid", "p_verein_id" "uuid", "p_organisation_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."abfall_versandlaeufe" (
    "abfuhr_datum" "date" NOT NULL,
    "gestartet_am" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."abfall_versandlaeufe" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."abfallkalender_einstellungen" (
    "gemeinde_id" "uuid" NOT NULL,
    "verfuegbare_typen" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "importiert_am" timestamp with time zone,
    "importiert_von" "text",
    "erstellt_am" timestamp with time zone DEFAULT "now"() NOT NULL,
    "aktualisiert_am" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."abfallkalender_einstellungen" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."abfallkalender_praeferenzen" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "gemeinde_id" "uuid" NOT NULL,
    "ausgewaehlte_typen" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "push_aktiviert" boolean DEFAULT true NOT NULL,
    "email_aktiviert" boolean DEFAULT false NOT NULL,
    "benachrichtigung_uhrzeit" "text" DEFAULT '18:00'::"text" NOT NULL,
    "erstellt_am" timestamp with time zone DEFAULT "now"() NOT NULL,
    "aktualisiert_am" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."abfallkalender_praeferenzen" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."abfalltermine" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gemeinde_id" "uuid" NOT NULL,
    "typ" "text" NOT NULL,
    "datum" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."abfalltermine" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."demo_anfragen" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "gemeinde" "text" NOT NULL,
    "email" "text" NOT NULL,
    "nachricht" "text",
    "fehlergrund" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."demo_anfragen" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."einladungen" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gemeinde_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "rolle" "text" NOT NULL,
    "organisation_name" "text",
    "verein_id" "uuid",
    "org_id" "uuid",
    "hinweis" "text",
    "token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(32), 'hex'::"text") NOT NULL,
    "eingeladen_von" "uuid",
    "erstellt_am" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ablauft_am" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "angenommen_am" timestamp with time zone,
    "status" "text" DEFAULT 'offen'::"text" NOT NULL,
    "mitglied_rolle" "text",
    CONSTRAINT "einladungen_mitglied_rolle_check" CHECK (("mitglied_rolle" = ANY (ARRAY['verwalter'::"text", 'autor'::"text"]))),
    CONSTRAINT "einladungen_rolle_check" CHECK (("rolle" = ANY (ARRAY['buerger'::"text", 'verein'::"text", 'organisation'::"text", 'gewerbe'::"text", 'gemeinderat'::"text", 'verwaltung'::"text"]))),
    CONSTRAINT "einladungen_status_check" CHECK (("status" = ANY (ARRAY['offen'::"text", 'angenommen'::"text", 'abgelaufen'::"text", 'widerrufen'::"text"])))
);


ALTER TABLE "public"."einladungen" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fragen" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "gemeinde_id" "uuid" NOT NULL,
    "fragesteller_id" "uuid" NOT NULL,
    "frage" "text" NOT NULL,
    "antwort" "text",
    "oeffentlich" boolean DEFAULT true,
    "status" "public"."frage_status" DEFAULT 'offen'::"public"."frage_status",
    "beantwortet_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."fragen" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gemeinden" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "bundesland" "text" NOT NULL,
    "einwohner" integer,
    "plz" "text",
    "slug" "text" NOT NULL,
    "logo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "features" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "notfallnummern_url" "text",
    "homepage_url" "text",
    "mitteilungsblatt_url" "text",
    "haushalte" integer,
    "primary_color" "text" DEFAULT '#0f2d6b'::"text",
    "ratsinformation_url" "text",
    "warncell_id" "text",
    "ist_oeffentlich" boolean DEFAULT false NOT NULL,
    "accent_color" "text" DEFAULT '#e8a020'::"text",
    CONSTRAINT "gemeinden_einwohner_check" CHECK (("einwohner" <= 10000))
);


ALTER TABLE "public"."gemeinden" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gemeinderat_fragen" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gemeinde_id" "uuid" NOT NULL,
    "fragesteller_id" "uuid" NOT NULL,
    "gemeinderat_id" "uuid" NOT NULL,
    "frage" "text" NOT NULL,
    "antwort" "text",
    "status" "text" DEFAULT 'offen'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "gelesen_von_buerger_at" timestamp with time zone,
    "gelesen_von_rat_at" timestamp with time zone,
    CONSTRAINT "gemeinderat_fragen_status_check" CHECK (("status" = ANY (ARRAY['offen'::"text", 'beantwortet'::"text", 'archiviert'::"text"])))
);


ALTER TABLE "public"."gemeinderat_fragen" OWNER TO "postgres";


COMMENT ON COLUMN "public"."gemeinderat_fragen"."gelesen_von_buerger_at" IS 'Zeitpunkt, zu dem der Fragesteller die Antwort gesehen hat. NULL = ungelesen.';



COMMENT ON COLUMN "public"."gemeinderat_fragen"."gelesen_von_rat_at" IS 'Zeitpunkt, zu dem der Gemeinderat die Frage gesehen hat. NULL = ungelesen.';



CREATE TABLE IF NOT EXISTS "public"."gewerbe_abonnements" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "gewerbe_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."gewerbe_abonnements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gewerbe_branchen" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "reihenfolge" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."gewerbe_branchen" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."maengel" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "gemeinde_id" "uuid" NOT NULL,
    "melder_id" "uuid" NOT NULL,
    "titel" "text" NOT NULL,
    "beschreibung" "text",
    "foto_url" "text",
    "lat" double precision,
    "lng" double precision,
    "adresse" "text",
    "status" "public"."maengel_status" DEFAULT 'offen'::"public"."maengel_status",
    "notiz_intern" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "nachricht_an_buerger" "text",
    "status_updated_at" timestamp with time zone
);


ALTER TABLE "public"."maengel" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meldungen" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gemeinde_id" "uuid" NOT NULL,
    "melder_id" "uuid" NOT NULL,
    "inhalt_typ" "text" NOT NULL,
    "inhalt_id" "uuid" NOT NULL,
    "grund" "text" NOT NULL,
    "beschreibung" "text",
    "status" "text" DEFAULT 'offen'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "meldungen_grund_check" CHECK (("grund" = ANY (ARRAY['illegal'::"text", 'spam'::"text", 'beleidigung'::"text", 'falsch'::"text", 'sonstiges'::"text"]))),
    CONSTRAINT "meldungen_inhalt_typ_check" CHECK (("inhalt_typ" = ANY (ARRAY['post'::"text", 'mangel'::"text", 'frage'::"text", 'antwort'::"text"]))),
    CONSTRAINT "meldungen_status_check" CHECK (("status" = ANY (ARRAY['offen'::"text", 'geprueft'::"text", 'abgelehnt'::"text"])))
);


ALTER TABLE "public"."meldungen" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mitgliedschaften" (
    "profile_id" "uuid" NOT NULL,
    "verein_id" "uuid",
    "organisation_id" "uuid",
    "rolle" "text" NOT NULL,
    "hinzugefuegt_von" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mitgliedschaften_genau_ein_ziel" CHECK (("num_nonnulls"("verein_id", "organisation_id") = 1)),
    CONSTRAINT "mitgliedschaften_rolle_check" CHECK (("rolle" = ANY (ARRAY['verwalter'::"text", 'autor'::"text"])))
);


ALTER TABLE "public"."mitgliedschaften" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."newsletter_subscribers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "municipality" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "confirmation_token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "confirmed_at" timestamp with time zone,
    CONSTRAINT "newsletter_subscribers_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'unsubscribed'::"text"])))
);


ALTER TABLE "public"."newsletter_subscribers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organisationen" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "gemeinde_id" "uuid" NOT NULL,
    "profile_id" "uuid",
    "name" "text" NOT NULL,
    "typ" "public"."org_type" NOT NULL,
    "beschreibung" "text",
    "logo_url" "text",
    "website" "text",
    "verified" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "adresse" "text",
    "oeffnungszeiten" "text",
    "plan" "text" DEFAULT 'standard'::"text" NOT NULL,
    "branche_id" "uuid"
);


ALTER TABLE "public"."organisationen" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_termine" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "datum" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."post_termine" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "gemeinde_id" "uuid" NOT NULL,
    "author_id" "uuid",
    "org_id" "uuid",
    "channel" "public"."post_channel" NOT NULL,
    "titel" "text" NOT NULL,
    "inhalt" "text" NOT NULL,
    "bild_url" "text",
    "pinned" boolean DEFAULT false,
    "published_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "sichtbarkeit" "text",
    "rejection_reason" "text",
    "tag" "text",
    "bilder_urls" "text"[],
    "publish_at" timestamp with time zone,
    "veranstaltung_datum" timestamp with time zone,
    "veranstaltung_ort" "text",
    "status" "public"."post_status" DEFAULT 'published'::"public"."post_status" NOT NULL,
    "dwd_id" "text",
    "severity" smallint,
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "sammlung_art" "text",
    "sammlung_datum" timestamp with time zone,
    "sammlung_organisator" "text",
    CONSTRAINT "posts_sammlung_felder_check" CHECK ((("tag" <> 'sammlung'::"text") OR (("sammlung_art" = ANY (ARRAY['altpapier'::"text", 'altkleider'::"text", 'altglas'::"text", 'schrott'::"text"])) AND ("sammlung_datum" IS NOT NULL) AND ("sammlung_organisator" IS NOT NULL) AND ("length"(TRIM(BOTH FROM "sammlung_organisator")) > 0)))),
    CONSTRAINT "posts_severity_check" CHECK ((("severity" >= 1) AND ("severity" <= 4))),
    CONSTRAINT "posts_sichtbarkeit_check" CHECK (("sichtbarkeit" = ANY (ARRAY['alle'::"text", 'abonnenten'::"text"])))
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "gemeinde_id" "uuid",
    "phone" "text",
    "display_name" "text",
    "role" "public"."user_role" DEFAULT 'buerger'::"public"."user_role" NOT NULL,
    "avatar_url" "text",
    "phone_verified" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "verein_name" "text",
    "email" "text",
    "fraktion" "text",
    "ueber_mich" "text",
    "kontakt_email" "text",
    "social_x" "text",
    "social_facebook" "text",
    "social_instagram" "text",
    "social_tiktok" "text",
    "vorname" "text",
    "nachname" "text",
    "terms_accepted_at" timestamp with time zone,
    "terms_version" "text",
    "age_confirmed_at" timestamp with time zone
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."profiles_public" WITH ("security_invoker"='off') AS
 SELECT "id",
    "gemeinde_id",
    "display_name",
    "verein_name",
    "role",
    "avatar_url",
        CASE
            WHEN ("public"."current_gemeinde_id"() IS NULL) THEN NULL::"text"
            ELSE "fraktion"
        END AS "fraktion",
        CASE
            WHEN ("public"."current_gemeinde_id"() IS NULL) THEN NULL::"text"
            ELSE "ueber_mich"
        END AS "ueber_mich",
        CASE
            WHEN ("public"."current_gemeinde_id"() IS NULL) THEN NULL::"text"
            ELSE "kontakt_email"
        END AS "kontakt_email",
        CASE
            WHEN ("public"."current_gemeinde_id"() IS NULL) THEN NULL::"text"
            ELSE "social_x"
        END AS "social_x",
        CASE
            WHEN ("public"."current_gemeinde_id"() IS NULL) THEN NULL::"text"
            ELSE "social_facebook"
        END AS "social_facebook",
        CASE
            WHEN ("public"."current_gemeinde_id"() IS NULL) THEN NULL::"text"
            ELSE "social_instagram"
        END AS "social_instagram",
        CASE
            WHEN ("public"."current_gemeinde_id"() IS NULL) THEN NULL::"text"
            ELSE "social_tiktok"
        END AS "social_tiktok"
   FROM "public"."profiles"
  WHERE (("role" <> 'buerger'::"public"."user_role") AND (("public"."current_gemeinde_id"() IS NULL) OR ("gemeinde_id" = "public"."current_gemeinde_id"())));


ALTER VIEW "public"."profiles_public" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rollen_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gemeinde_id" "uuid" NOT NULL,
    "aktion" "text" NOT NULL,
    "ziel_profile_id" "uuid",
    "ziel_email" "text" NOT NULL,
    "alte_rolle" "text",
    "neue_rolle" "text",
    "einladung_id" "uuid",
    "ausgefuehrt_von" "uuid" NOT NULL,
    "erstellt_am" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rollen_log_aktion_check" CHECK (("aktion" = ANY (ARRAY['eingeladen'::"text", 'rolle_gesetzt'::"text", 'rolle_transfer'::"text", 'widerrufen'::"text", 'mitglied_hinzugefuegt'::"text", 'mitglied_entfernt'::"text", 'mitglied_rolle_geaendert'::"text", 'verein_geloescht'::"text"])))
);


ALTER TABLE "public"."rollen_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sms_verifications" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "phone" "text" NOT NULL,
    "code" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sms_verifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."umfrage_antworten" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "umfrage_id" "uuid" NOT NULL,
    "frage_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "antwort_text" "text",
    "option_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."umfrage_antworten" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."umfrage_fragen" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "umfrage_id" "uuid" NOT NULL,
    "reihenfolge" integer DEFAULT 0 NOT NULL,
    "frage_text" "text" NOT NULL,
    "typ" "text" NOT NULL,
    "bilder_urls" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    CONSTRAINT "umfrage_fragen_typ_check" CHECK (("typ" = ANY (ARRAY['ja_nein'::"text", 'einzelauswahl'::"text", 'mehrfachauswahl'::"text", 'bewertung'::"text"])))
);


ALTER TABLE "public"."umfrage_fragen" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."umfrage_optionen" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "frage_id" "uuid" NOT NULL,
    "option_text" "text" NOT NULL,
    "reihenfolge" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."umfrage_optionen" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."umfrage_teilnahmen" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "umfrage_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."umfrage_teilnahmen" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."umfragen" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gemeinde_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "titel" "text" NOT NULL,
    "beschreibung" "text",
    "enddatum" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "bilder_urls" "text"[] DEFAULT '{}'::"text"[] NOT NULL
);


ALTER TABLE "public"."umfragen" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."verein_abonnements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "verein_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."verein_abonnements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."verein_kategorien" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "reihenfolge" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."verein_kategorien" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vereine" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid",
    "gemeinde_id" "uuid" NOT NULL,
    "verein_name" "text" NOT NULL,
    "typ" "text" NOT NULL,
    "kategorie_id" "uuid",
    "beschreibung" "text",
    "website" "text",
    "logo_url" "text",
    "verified" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "vereine_typ_check" CHECK (("typ" = ANY (ARRAY['verein'::"text", 'organisation'::"text"])))
);


ALTER TABLE "public"."vereine" OWNER TO "postgres";


ALTER TABLE ONLY "public"."abfall_versandlaeufe"
    ADD CONSTRAINT "abfall_versandlaeufe_pkey" PRIMARY KEY ("abfuhr_datum");



ALTER TABLE ONLY "public"."abfallkalender_einstellungen"
    ADD CONSTRAINT "abfallkalender_einstellungen_pkey" PRIMARY KEY ("gemeinde_id");



ALTER TABLE ONLY "public"."abfallkalender_praeferenzen"
    ADD CONSTRAINT "abfallkalender_praeferenzen_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."abfallkalender_praeferenzen"
    ADD CONSTRAINT "abfallkalender_praeferenzen_user_id_gemeinde_id_key" UNIQUE ("user_id", "gemeinde_id");



ALTER TABLE ONLY "public"."abfalltermine"
    ADD CONSTRAINT "abfalltermine_gemeinde_id_typ_datum_key" UNIQUE ("gemeinde_id", "typ", "datum");



ALTER TABLE ONLY "public"."abfalltermine"
    ADD CONSTRAINT "abfalltermine_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."demo_anfragen"
    ADD CONSTRAINT "demo_anfragen_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."einladungen"
    ADD CONSTRAINT "einladungen_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fragen"
    ADD CONSTRAINT "fragen_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gemeinden"
    ADD CONSTRAINT "gemeinden_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gemeinden"
    ADD CONSTRAINT "gemeinden_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."gemeinderat_fragen"
    ADD CONSTRAINT "gemeinderat_fragen_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gewerbe_abonnements"
    ADD CONSTRAINT "gewerbe_abonnements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gewerbe_abonnements"
    ADD CONSTRAINT "gewerbe_abonnements_user_id_gewerbe_id_key" UNIQUE ("user_id", "gewerbe_id");



ALTER TABLE ONLY "public"."gewerbe_branchen"
    ADD CONSTRAINT "gewerbe_branchen_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."gewerbe_branchen"
    ADD CONSTRAINT "gewerbe_branchen_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."maengel"
    ADD CONSTRAINT "maengel_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meldungen"
    ADD CONSTRAINT "meldungen_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mitgliedschaften"
    ADD CONSTRAINT "mitgliedschaften_pkey" PRIMARY KEY ("profile_id");



ALTER TABLE ONLY "public"."newsletter_subscribers"
    ADD CONSTRAINT "newsletter_subscribers_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."newsletter_subscribers"
    ADD CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organisationen"
    ADD CONSTRAINT "organisationen_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_termine"
    ADD CONSTRAINT "post_termine_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rollen_log"
    ADD CONSTRAINT "rollen_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sms_verifications"
    ADD CONSTRAINT "sms_verifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."umfrage_antworten"
    ADD CONSTRAINT "umfrage_antworten_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."umfrage_fragen"
    ADD CONSTRAINT "umfrage_fragen_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."umfrage_optionen"
    ADD CONSTRAINT "umfrage_optionen_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."umfrage_teilnahmen"
    ADD CONSTRAINT "umfrage_teilnahmen_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."umfrage_teilnahmen"
    ADD CONSTRAINT "umfrage_teilnahmen_umfrage_id_user_id_key" UNIQUE ("umfrage_id", "user_id");



ALTER TABLE ONLY "public"."umfragen"
    ADD CONSTRAINT "umfragen_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."verein_abonnements"
    ADD CONSTRAINT "verein_abonnements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."verein_abonnements"
    ADD CONSTRAINT "verein_abonnements_user_id_verein_id_key" UNIQUE ("user_id", "verein_id");



ALTER TABLE ONLY "public"."verein_kategorien"
    ADD CONSTRAINT "verein_kategorien_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vereine"
    ADD CONSTRAINT "vereine_pkey" PRIMARY KEY ("id");



CREATE INDEX "abfalltermine_gemeinde_datum" ON "public"."abfalltermine" USING "btree" ("gemeinde_id", "datum");



CREATE INDEX "fragen_gemeinde_idx" ON "public"."fragen" USING "btree" ("gemeinde_id", "oeffentlich", "created_at" DESC);



CREATE INDEX "gemeinden_warncell_id_idx" ON "public"."gemeinden" USING "btree" ("warncell_id") WHERE ("warncell_id" IS NOT NULL);



CREATE INDEX "gemeinderat_fragen_ungelesen_buerger_idx" ON "public"."gemeinderat_fragen" USING "btree" ("fragesteller_id") WHERE ("gelesen_von_buerger_at" IS NULL);



CREATE INDEX "gemeinderat_fragen_ungelesen_rat_idx" ON "public"."gemeinderat_fragen" USING "btree" ("gemeinderat_id") WHERE ("gelesen_von_rat_at" IS NULL);



CREATE INDEX "gewerbe_abonnements_gewerbe_idx" ON "public"."gewerbe_abonnements" USING "btree" ("gewerbe_id");



CREATE INDEX "gewerbe_abonnements_user_idx" ON "public"."gewerbe_abonnements" USING "btree" ("user_id");



CREATE INDEX "idx_posts_sammlung" ON "public"."posts" USING "btree" ("gemeinde_id", "sammlung_datum") WHERE (("tag" = 'sammlung'::"text") AND ("status" = 'published'::"public"."post_status"));



CREATE INDEX "maengel_gemeinde_status_idx" ON "public"."maengel" USING "btree" ("gemeinde_id", "status", "created_at" DESC);



CREATE INDEX "mitgliedschaften_organisation_idx" ON "public"."mitgliedschaften" USING "btree" ("organisation_id");



CREATE INDEX "mitgliedschaften_verein_idx" ON "public"."mitgliedschaften" USING "btree" ("verein_id");



CREATE INDEX "post_termine_datum_idx" ON "public"."post_termine" USING "btree" ("datum");



CREATE INDEX "post_termine_post_id_idx" ON "public"."post_termine" USING "btree" ("post_id");



CREATE INDEX "posts_gemeinde_channel_idx" ON "public"."posts" USING "btree" ("gemeinde_id", "channel", "published_at" DESC);



CREATE UNIQUE INDEX "posts_gemeinde_dwd_id_unique" ON "public"."posts" USING "btree" ("gemeinde_id", "dwd_id") WHERE ("dwd_id" IS NOT NULL);



CREATE UNIQUE INDEX "profiles_email_idx" ON "public"."profiles" USING "btree" ("email") WHERE ("email" IS NOT NULL);



CREATE INDEX "sms_verif_phone_idx" ON "public"."sms_verifications" USING "btree" ("phone", "created_at" DESC);



CREATE OR REPLACE TRIGGER "betrieb_fuer_gemeinde_abonnieren" AFTER INSERT OR UPDATE OF "gemeinde_id", "typ" ON "public"."organisationen" FOR EACH ROW EXECUTE FUNCTION "public"."betrieb_fuer_gemeinde_abonnieren"();



CREATE OR REPLACE TRIGGER "maengel_updated_at" BEFORE UPDATE ON "public"."maengel" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "profil_abonniert_gemeinde" AFTER INSERT OR UPDATE OF "gemeinde_id" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."profil_abonniert_gemeinde"();



CREATE OR REPLACE TRIGGER "profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "verein_fuer_gemeinde_abonnieren" AFTER INSERT OR UPDATE OF "gemeinde_id" ON "public"."vereine" FOR EACH ROW EXECUTE FUNCTION "public"."verein_fuer_gemeinde_abonnieren"();



ALTER TABLE ONLY "public"."abfallkalender_einstellungen"
    ADD CONSTRAINT "abfallkalender_einstellungen_gemeinde_id_fkey" FOREIGN KEY ("gemeinde_id") REFERENCES "public"."gemeinden"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."abfallkalender_praeferenzen"
    ADD CONSTRAINT "abfallkalender_praeferenzen_gemeinde_id_fkey" FOREIGN KEY ("gemeinde_id") REFERENCES "public"."gemeinden"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."abfallkalender_praeferenzen"
    ADD CONSTRAINT "abfallkalender_praeferenzen_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."abfalltermine"
    ADD CONSTRAINT "abfalltermine_gemeinde_id_fkey" FOREIGN KEY ("gemeinde_id") REFERENCES "public"."gemeinden"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."einladungen"
    ADD CONSTRAINT "einladungen_eingeladen_von_fkey" FOREIGN KEY ("eingeladen_von") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."einladungen"
    ADD CONSTRAINT "einladungen_gemeinde_id_fkey" FOREIGN KEY ("gemeinde_id") REFERENCES "public"."gemeinden"("id");



ALTER TABLE ONLY "public"."fragen"
    ADD CONSTRAINT "fragen_fragesteller_id_fkey" FOREIGN KEY ("fragesteller_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."fragen"
    ADD CONSTRAINT "fragen_gemeinde_id_fkey" FOREIGN KEY ("gemeinde_id") REFERENCES "public"."gemeinden"("id");



ALTER TABLE ONLY "public"."gemeinderat_fragen"
    ADD CONSTRAINT "gemeinderat_fragen_fragesteller_id_fkey" FOREIGN KEY ("fragesteller_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gemeinderat_fragen"
    ADD CONSTRAINT "gemeinderat_fragen_gemeinde_id_fkey" FOREIGN KEY ("gemeinde_id") REFERENCES "public"."gemeinden"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gemeinderat_fragen"
    ADD CONSTRAINT "gemeinderat_fragen_gemeinderat_id_fkey" FOREIGN KEY ("gemeinderat_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gewerbe_abonnements"
    ADD CONSTRAINT "gewerbe_abonnements_gewerbe_id_fkey" FOREIGN KEY ("gewerbe_id") REFERENCES "public"."organisationen"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gewerbe_abonnements"
    ADD CONSTRAINT "gewerbe_abonnements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."maengel"
    ADD CONSTRAINT "maengel_gemeinde_id_fkey" FOREIGN KEY ("gemeinde_id") REFERENCES "public"."gemeinden"("id");



ALTER TABLE ONLY "public"."maengel"
    ADD CONSTRAINT "maengel_melder_id_fkey" FOREIGN KEY ("melder_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."meldungen"
    ADD CONSTRAINT "meldungen_gemeinde_id_fkey" FOREIGN KEY ("gemeinde_id") REFERENCES "public"."gemeinden"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meldungen"
    ADD CONSTRAINT "meldungen_melder_id_fkey" FOREIGN KEY ("melder_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mitgliedschaften"
    ADD CONSTRAINT "mitgliedschaften_hinzugefuegt_von_fkey" FOREIGN KEY ("hinzugefuegt_von") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mitgliedschaften"
    ADD CONSTRAINT "mitgliedschaften_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisationen"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mitgliedschaften"
    ADD CONSTRAINT "mitgliedschaften_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mitgliedschaften"
    ADD CONSTRAINT "mitgliedschaften_verein_id_fkey" FOREIGN KEY ("verein_id") REFERENCES "public"."vereine"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organisationen"
    ADD CONSTRAINT "organisationen_branche_id_fkey" FOREIGN KEY ("branche_id") REFERENCES "public"."gewerbe_branchen"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organisationen"
    ADD CONSTRAINT "organisationen_gemeinde_id_fkey" FOREIGN KEY ("gemeinde_id") REFERENCES "public"."gemeinden"("id");



ALTER TABLE ONLY "public"."organisationen"
    ADD CONSTRAINT "organisationen_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."post_termine"
    ADD CONSTRAINT "post_termine_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_gemeinde_id_fkey" FOREIGN KEY ("gemeinde_id") REFERENCES "public"."gemeinden"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_gemeinde_id_fkey" FOREIGN KEY ("gemeinde_id") REFERENCES "public"."gemeinden"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rollen_log"
    ADD CONSTRAINT "rollen_log_gemeinde_id_fkey" FOREIGN KEY ("gemeinde_id") REFERENCES "public"."gemeinden"("id");



ALTER TABLE ONLY "public"."umfrage_antworten"
    ADD CONSTRAINT "umfrage_antworten_frage_id_fkey" FOREIGN KEY ("frage_id") REFERENCES "public"."umfrage_fragen"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."umfrage_antworten"
    ADD CONSTRAINT "umfrage_antworten_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "public"."umfrage_optionen"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."umfrage_antworten"
    ADD CONSTRAINT "umfrage_antworten_umfrage_id_fkey" FOREIGN KEY ("umfrage_id") REFERENCES "public"."umfragen"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."umfrage_antworten"
    ADD CONSTRAINT "umfrage_antworten_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."umfrage_fragen"
    ADD CONSTRAINT "umfrage_fragen_umfrage_id_fkey" FOREIGN KEY ("umfrage_id") REFERENCES "public"."umfragen"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."umfrage_optionen"
    ADD CONSTRAINT "umfrage_optionen_frage_id_fkey" FOREIGN KEY ("frage_id") REFERENCES "public"."umfrage_fragen"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."umfrage_teilnahmen"
    ADD CONSTRAINT "umfrage_teilnahmen_umfrage_id_fkey" FOREIGN KEY ("umfrage_id") REFERENCES "public"."umfragen"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."umfrage_teilnahmen"
    ADD CONSTRAINT "umfrage_teilnahmen_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."umfragen"
    ADD CONSTRAINT "umfragen_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."umfragen"
    ADD CONSTRAINT "umfragen_gemeinde_id_fkey" FOREIGN KEY ("gemeinde_id") REFERENCES "public"."gemeinden"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."verein_abonnements"
    ADD CONSTRAINT "verein_abonnements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."verein_abonnements"
    ADD CONSTRAINT "verein_abonnements_verein_id_fkey" FOREIGN KEY ("verein_id") REFERENCES "public"."vereine"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vereine"
    ADD CONSTRAINT "vereine_gemeinde_id_fkey" FOREIGN KEY ("gemeinde_id") REFERENCES "public"."gemeinden"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vereine"
    ADD CONSTRAINT "vereine_kategorie_id_fkey" FOREIGN KEY ("kategorie_id") REFERENCES "public"."verein_kategorien"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vereine"
    ADD CONSTRAINT "vereine_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



CREATE POLICY "Abonnement kündigen" ON "public"."gewerbe_abonnements" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Abonnieren" ON "public"."gewerbe_abonnements" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Branchen lesen" ON "public"."gewerbe_branchen" FOR SELECT USING (true);



CREATE POLICY "Eigene Abonnements lesen" ON "public"."gewerbe_abonnements" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Eigenes Profil bearbeiten" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Eigenes Profil lesen" ON "public"."profiles" FOR SELECT USING (("id" = "auth"."uid"()));



CREATE POLICY "Fragen beantworten" ON "public"."fragen" FOR UPDATE TO "authenticated" USING (("public"."is_verwaltung"() AND ("gemeinde_id" = "public"."current_gemeinde_id"()))) WITH CHECK (("public"."is_verwaltung"() AND ("gemeinde_id" = "public"."current_gemeinde_id"())));



CREATE POLICY "Fragen lesen" ON "public"."fragen" FOR SELECT TO "authenticated" USING ((("fragesteller_id" = "auth"."uid"()) OR (("gemeinde_id" = "public"."current_gemeinde_id"()) AND (("oeffentlich" = true) OR "public"."is_verwaltung"()))));



CREATE POLICY "Fragen stellen" ON "public"."fragen" FOR INSERT TO "authenticated" WITH CHECK ((("fragesteller_id" = "auth"."uid"()) AND ("gemeinde_id" = "public"."current_gemeinde_id"())));



CREATE POLICY "Gemeinden lesbar" ON "public"."gemeinden" FOR SELECT USING (true);



CREATE POLICY "Gewerbe sieht Anzahl" ON "public"."gewerbe_abonnements" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organisationen" "o"
  WHERE (("o"."id" = "gewerbe_abonnements"."gewerbe_id") AND ("o"."profile_id" = "auth"."uid"())))));



CREATE POLICY "Jeder eingeloggte Bürger kann melden" ON "public"."meldungen" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "melder_id"));



CREATE POLICY "Mängel lesen" ON "public"."maengel" FOR SELECT USING (true);



CREATE POLICY "Mängel melden" ON "public"."maengel" FOR INSERT WITH CHECK (("auth"."uid"() = "melder_id"));



CREATE POLICY "Mängel verwalten" ON "public"."maengel" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['verwaltung'::"public"."user_role", 'super_admin'::"public"."user_role"]))))));



CREATE POLICY "Organisationen lesen" ON "public"."organisationen" FOR SELECT TO "authenticated" USING (("gemeinde_id" = "public"."current_gemeinde_id"()));



CREATE POLICY "Posts bearbeiten" ON "public"."posts" FOR UPDATE USING (("author_id" = "auth"."uid"()));



CREATE POLICY "Posts erstellen" ON "public"."posts" FOR INSERT TO "authenticated" WITH CHECK ((("author_id" = "auth"."uid"()) AND ("gemeinde_id" = "public"."current_gemeinde_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['organisation'::"public"."user_role", 'verwaltung'::"public"."user_role", 'super_admin'::"public"."user_role", 'gewerbe'::"public"."user_role"])))))));



CREATE POLICY "Posts lesen" ON "public"."posts" FOR SELECT USING (true);



CREATE POLICY "Profil anlegen" ON "public"."profiles" FOR INSERT WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "SMS intern" ON "public"."sms_verifications" USING (false);



CREATE POLICY "Super Admin Gemeinden verwalten" ON "public"."gemeinden" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"public"."user_role")))));



CREATE POLICY "Verwaltung sieht Meldungen ihrer Gemeinde" ON "public"."meldungen" FOR SELECT TO "authenticated" USING ((("gemeinde_id" IN ( SELECT "profiles"."gemeinde_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['verwaltung'::"public"."user_role", 'super_admin'::"public"."user_role"])))))));



ALTER TABLE "public"."abfall_versandlaeufe" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."abfallkalender_einstellungen" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "abfallkalender_einstellungen_select" ON "public"."abfallkalender_einstellungen" FOR SELECT USING (true);



CREATE POLICY "abfallkalender_einstellungen_write_service" ON "public"."abfallkalender_einstellungen" USING (false);



ALTER TABLE "public"."abfallkalender_praeferenzen" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."abfalltermine" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "abfalltermine_delete_service" ON "public"."abfalltermine" FOR DELETE USING (false);



CREATE POLICY "abfalltermine_insert_service" ON "public"."abfalltermine" FOR INSERT WITH CHECK (false);



CREATE POLICY "abfalltermine_select" ON "public"."abfalltermine" FOR SELECT USING (true);



ALTER TABLE "public"."demo_anfragen" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "demo_anfragen_service_only" ON "public"."demo_anfragen" USING (false);



ALTER TABLE "public"."einladungen" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "einladungen_aktualisieren" ON "public"."einladungen" FOR UPDATE TO "authenticated" USING (("public"."is_super_admin"() OR ("public"."is_verwaltung"() AND ("gemeinde_id" = "public"."current_gemeinde_id"())))) WITH CHECK (("public"."is_super_admin"() OR ("public"."is_verwaltung"() AND ("gemeinde_id" = "public"."current_gemeinde_id"()))));



CREATE POLICY "einladungen_erstellen" ON "public"."einladungen" FOR INSERT TO "authenticated" WITH CHECK ((("eingeladen_von" = "auth"."uid"()) AND ("public"."is_super_admin"() OR ("public"."is_verwaltung"() AND ("gemeinde_id" = "public"."current_gemeinde_id"())))));



CREATE POLICY "einladungen_lesen" ON "public"."einladungen" FOR SELECT TO "authenticated" USING (("public"."is_super_admin"() OR ("public"."is_verwaltung"() AND ("gemeinde_id" = "public"."current_gemeinde_id"()))));



ALTER TABLE "public"."fragen" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gemeinden" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gemeinderat_fragen" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gemeinderat_fragen_beantworten" ON "public"."gemeinderat_fragen" FOR UPDATE TO "authenticated" USING (("gemeinderat_id" = "auth"."uid"()));



CREATE POLICY "gemeinderat_fragen_lesen" ON "public"."gemeinderat_fragen" FOR SELECT TO "authenticated" USING ((("fragesteller_id" = "auth"."uid"()) OR ("gemeinderat_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."gemeinde_id" = "gemeinderat_fragen"."gemeinde_id") AND ("profiles"."role" = ANY (ARRAY['verwaltung'::"public"."user_role", 'super_admin'::"public"."user_role"])))))));



CREATE POLICY "gemeinderat_fragen_stellen" ON "public"."gemeinderat_fragen" FOR INSERT TO "authenticated" WITH CHECK (("fragesteller_id" = "auth"."uid"()));



ALTER TABLE "public"."gewerbe_abonnements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gewerbe_branchen" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."maengel" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meldungen" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mitgliedschaften" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mitgliedschaften_eigene_lesen" ON "public"."mitgliedschaften" FOR SELECT TO "authenticated" USING (("profile_id" = "auth"."uid"()));



ALTER TABLE "public"."newsletter_subscribers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "newsletter_subscribers_service_only" ON "public"."newsletter_subscribers" USING (false);



ALTER TABLE "public"."organisationen" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organisationen_anon_lesen" ON "public"."organisationen" FOR SELECT TO "anon" USING (("typ" = 'gewerbe'::"public"."org_type"));



ALTER TABLE "public"."post_termine" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "post_termine_eigene_verwalten" ON "public"."post_termine" USING ((EXISTS ( SELECT 1
   FROM "public"."posts" "p"
  WHERE (("p"."id" = "post_termine"."post_id") AND ("p"."author_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."posts" "p"
  WHERE (("p"."id" = "post_termine"."post_id") AND ("p"."author_id" = "auth"."uid"())))));



CREATE POLICY "post_termine_lesen" ON "public"."post_termine" FOR SELECT USING (true);



ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "praeferenzen_eigene_delete" ON "public"."abfallkalender_praeferenzen" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "praeferenzen_eigene_insert" ON "public"."abfallkalender_praeferenzen" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "praeferenzen_eigene_select" ON "public"."abfallkalender_praeferenzen" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "praeferenzen_eigene_update" ON "public"."abfallkalender_praeferenzen" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select_verwaltung" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("public"."is_verwaltung"() AND ("gemeinde_id" = "public"."current_gemeinde_id"())));



ALTER TABLE "public"."rollen_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rollen_log_lesen" ON "public"."rollen_log" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."gemeinde_id" = "rollen_log"."gemeinde_id") AND ("profiles"."role" = ANY (ARRAY['verwaltung'::"public"."user_role", 'super_admin'::"public"."user_role"]))))));



CREATE POLICY "rollen_log_schreiben" ON "public"."rollen_log" FOR INSERT TO "authenticated" WITH CHECK (("ausgefuehrt_von" = "auth"."uid"()));



ALTER TABLE "public"."sms_verifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."umfrage_antworten" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "umfrage_antworten_eigene_lesen" ON "public"."umfrage_antworten" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "umfrage_antworten_einfuegen" ON "public"."umfrage_antworten" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "umfrage_antworten_loeschen" ON "public"."umfrage_antworten" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."umfrage_fragen" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "umfrage_fragen_lesen" ON "public"."umfrage_fragen" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."umfragen" "u"
  WHERE (("u"."id" = "umfrage_fragen"."umfrage_id") AND ("u"."gemeinde_id" = "public"."current_gemeinde_id"()) AND ("public"."is_verwaltung"() OR ("u"."enddatum" IS NULL) OR ("u"."enddatum" >= "now"()))))));



ALTER TABLE "public"."umfrage_optionen" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "umfrage_optionen_lesen" ON "public"."umfrage_optionen" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."umfrage_fragen" "f"
     JOIN "public"."umfragen" "u" ON (("u"."id" = "f"."umfrage_id")))
  WHERE (("f"."id" = "umfrage_optionen"."frage_id") AND ("u"."gemeinde_id" = "public"."current_gemeinde_id"()) AND ("public"."is_verwaltung"() OR ("u"."enddatum" IS NULL) OR ("u"."enddatum" >= "now"()))))));



ALTER TABLE "public"."umfrage_teilnahmen" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "umfrage_teilnahmen_eigene" ON "public"."umfrage_teilnahmen" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."umfragen" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "umfragen_lesen" ON "public"."umfragen" FOR SELECT TO "authenticated" USING ((("gemeinde_id" = "public"."current_gemeinde_id"()) AND ("public"."is_verwaltung"() OR ("enddatum" IS NULL) OR ("enddatum" >= "now"()))));



CREATE POLICY "umfragen_verwalten" ON "public"."umfragen" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."gemeinde_id" = "umfragen"."gemeinde_id") AND ("profiles"."role" = ANY (ARRAY['verwaltung'::"public"."user_role", 'super_admin'::"public"."user_role"]))))));



ALTER TABLE "public"."verein_abonnements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "verein_abonnements_delete_own" ON "public"."verein_abonnements" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "verein_abonnements_insert_own" ON "public"."verein_abonnements" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "verein_abonnements_read_own" ON "public"."verein_abonnements" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."verein_kategorien" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "verein_kategorien_anon_lesen" ON "public"."verein_kategorien" FOR SELECT TO "anon" USING (true);



CREATE POLICY "verein_kategorien_read" ON "public"."verein_kategorien" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."vereine" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vereine_anon_lesen" ON "public"."vereine" FOR SELECT TO "anon" USING (true);



CREATE POLICY "vereine_read" ON "public"."vereine" FOR SELECT TO "authenticated" USING (("gemeinde_id" = "public"."current_gemeinde_id"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT ALL ON SCHEMA "public" TO PUBLIC;






















































































































































REVOKE ALL ON FUNCTION "public"."_mitglied_eintragen"("p_profile_id" "uuid", "p_verein_id" "uuid", "p_organisation_id" "uuid", "p_rolle" "text", "p_akteur" "uuid", "p_jede_rolle" boolean) FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."_mitglieder_recht"("p_akteur" "uuid", "p_verein_id" "uuid", "p_organisation_id" "uuid", "p_gemeinde_id" "uuid") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."_pfad_anderweitig_genutzt"("p_pfad" "text", "p_org_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."_rollen_log"("p_gemeinde_id" "uuid", "p_aktion" "text", "p_profile_id" "uuid", "p_alte" "text", "p_neue" "text", "p_akteur" "uuid") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."_vereinszeile_anlegen"("p_typ" "text", "p_gemeinde_id" "uuid", "p_name" "text", "p_profile_id" "uuid") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."_vereinsziel"("p_verein_id" "uuid", "p_organisation_id" "uuid", OUT "o_gemeinde_id" "uuid", OUT "o_rolle" "text", OUT "o_name" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."_weiterer_verwalter"("p_verein_id" "uuid", "p_organisation_id" "uuid", "p_ohne" "uuid") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."betrieb_fuer_gemeinde_abonnieren"() FROM PUBLIC;



GRANT ALL ON FUNCTION "public"."current_gemeinde_id"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."einladung_einloesen"("p_profile_id" "uuid", "p_einladung_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."einladung_einloesen"("p_profile_id" "uuid", "p_einladung_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."einladungen_ablauf_aktualisieren"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."einladungen_ablauf_aktualisieren"() TO "service_role";
GRANT ALL ON FUNCTION "public"."einladungen_ablauf_aktualisieren"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_einladung_by_token"("p_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_einladung_by_token"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_einladung_by_token"("p_token" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."is_verwaltung"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."konto_dateipfade"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."konto_dateipfade"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."konto_loeschen"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."konto_loeschen"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mitglied_entfernen"("p_profile_id" "uuid", "p_ausgefuehrt_von" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mitglied_entfernen"("p_profile_id" "uuid", "p_ausgefuehrt_von" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mitglied_hinzufuegen"("p_profile_id" "uuid", "p_rolle" "text", "p_ausgefuehrt_von" "uuid", "p_verein_id" "uuid", "p_organisation_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mitglied_hinzufuegen"("p_profile_id" "uuid", "p_rolle" "text", "p_ausgefuehrt_von" "uuid", "p_verein_id" "uuid", "p_organisation_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mitglied_rolle_aendern"("p_profile_id" "uuid", "p_rolle" "text", "p_ausgefuehrt_von" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mitglied_rolle_aendern"("p_profile_id" "uuid", "p_rolle" "text", "p_ausgefuehrt_von" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."profil_abonniert_gemeinde"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."superadmin_buerger_stats"("p_gemeinde_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."superadmin_buerger_stats"("p_gemeinde_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."superadmin_maengel_stats"("p_gemeinde_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."superadmin_maengel_stats"("p_gemeinde_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."superadmin_posts_stats"("p_gemeinde_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."superadmin_posts_stats"("p_gemeinde_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."superadmin_produzentenaccounts"("p_rolle" "text", "p_gemeinde_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."superadmin_produzentenaccounts"("p_rolle" "text", "p_gemeinde_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."superadmin_rollen_stats"("p_gemeinde_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."superadmin_rollen_stats"("p_gemeinde_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."umfrage_ergebnisse"("p_umfrage_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."umfrage_teilnehmer_anzahl"("p_umfrage_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."umfrage_teilnehmer_anzahlen"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."verein_anlegen"("p_profile_id" "uuid", "p_typ" "text", "p_name" "text", "p_ausgefuehrt_von" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."verein_anlegen"("p_profile_id" "uuid", "p_typ" "text", "p_name" "text", "p_ausgefuehrt_von" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."verein_dateipfade"("p_verein_id" "uuid", "p_organisation_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."verein_dateipfade"("p_verein_id" "uuid", "p_organisation_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."verein_fuer_gemeinde_abonnieren"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."verein_loeschen"("p_ausgefuehrt_von" "uuid", "p_verein_id" "uuid", "p_organisation_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."verein_loeschen"("p_ausgefuehrt_von" "uuid", "p_verein_id" "uuid", "p_organisation_id" "uuid") TO "service_role";


















GRANT SELECT,INSERT,DELETE ON TABLE "public"."abfall_versandlaeufe" TO "service_role";



GRANT SELECT ON TABLE "public"."abfallkalender_einstellungen" TO "authenticated";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."abfallkalender_einstellungen" TO "service_role";
GRANT SELECT ON TABLE "public"."abfallkalender_einstellungen" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."abfallkalender_praeferenzen" TO "authenticated";



GRANT SELECT ON TABLE "public"."abfalltermine" TO "authenticated";
GRANT SELECT,INSERT,DELETE ON TABLE "public"."abfalltermine" TO "service_role";
GRANT SELECT ON TABLE "public"."abfalltermine" TO "anon";



GRANT SELECT,INSERT ON TABLE "public"."demo_anfragen" TO "service_role";



GRANT SELECT,INSERT,UPDATE ON TABLE "public"."einladungen" TO "authenticated";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."einladungen" TO "service_role";



GRANT SELECT,INSERT,UPDATE ON TABLE "public"."fragen" TO "authenticated";
GRANT SELECT,DELETE,UPDATE ON TABLE "public"."fragen" TO "service_role";



GRANT SELECT ON TABLE "public"."gemeinden" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."gemeinden" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."gemeinden" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."gemeinderat_fragen" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."gemeinderat_fragen" TO "service_role";



GRANT SELECT,INSERT,DELETE ON TABLE "public"."gewerbe_abonnements" TO "authenticated";
GRANT SELECT ON TABLE "public"."gewerbe_abonnements" TO "service_role";



GRANT SELECT ON TABLE "public"."gewerbe_branchen" TO "anon";
GRANT SELECT ON TABLE "public"."gewerbe_branchen" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."maengel" TO "authenticated";
GRANT SELECT,DELETE,UPDATE ON TABLE "public"."maengel" TO "service_role";



GRANT SELECT,INSERT ON TABLE "public"."meldungen" TO "authenticated";



GRANT SELECT ON TABLE "public"."mitgliedschaften" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."mitgliedschaften" TO "service_role";



GRANT SELECT,INSERT,UPDATE ON TABLE "public"."newsletter_subscribers" TO "service_role";



GRANT SELECT ON TABLE "public"."organisationen" TO "authenticated";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."organisationen" TO "service_role";
GRANT SELECT ON TABLE "public"."organisationen" TO "anon";



GRANT SELECT ON TABLE "public"."post_termine" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."post_termine" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."post_termine" TO "service_role";



GRANT SELECT ON TABLE "public"."posts" TO "anon";
GRANT SELECT ON TABLE "public"."posts" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."posts" TO "service_role";



GRANT SELECT ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."profiles" TO "service_role";



GRANT UPDATE("display_name") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("avatar_url") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("verein_name") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("fraktion") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("ueber_mich") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("kontakt_email") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("social_x") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("social_facebook") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("social_instagram") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("social_tiktok") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("vorname") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("nachname") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT ON TABLE "public"."profiles_public" TO "authenticated";
GRANT SELECT ON TABLE "public"."profiles_public" TO "anon";



GRANT SELECT,INSERT ON TABLE "public"."rollen_log" TO "authenticated";
GRANT SELECT,INSERT ON TABLE "public"."rollen_log" TO "service_role";



GRANT SELECT,INSERT,DELETE ON TABLE "public"."umfrage_antworten" TO "authenticated";
GRANT SELECT,INSERT,DELETE ON TABLE "public"."umfrage_antworten" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."umfrage_fragen" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."umfrage_fragen" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."umfrage_optionen" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."umfrage_optionen" TO "service_role";



GRANT SELECT,INSERT,DELETE ON TABLE "public"."umfrage_teilnahmen" TO "authenticated";
GRANT SELECT,INSERT,DELETE ON TABLE "public"."umfrage_teilnahmen" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."umfragen" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."umfragen" TO "service_role";



GRANT SELECT,INSERT,DELETE ON TABLE "public"."verein_abonnements" TO "authenticated";
GRANT SELECT ON TABLE "public"."verein_abonnements" TO "service_role";



GRANT SELECT ON TABLE "public"."verein_kategorien" TO "authenticated";
GRANT SELECT ON TABLE "public"."verein_kategorien" TO "anon";



GRANT SELECT ON TABLE "public"."vereine" TO "authenticated";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."vereine" TO "service_role";
GRANT SELECT ON TABLE "public"."vereine" TO "anon";


































