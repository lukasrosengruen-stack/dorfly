-- 065: Mehrere Autoren und Verwalter pro Verein, Organisation und Gewerbe.
--
-- Bisher gehörte ein Verein (vereine, Rollen verein/organisation) bzw. ein Gewerbe
-- (organisationen, Rolle gewerbe) genau einem Konto (profile_id). Löschte dieses
-- Konto sich, löschte die Cascade den Verein samt Abonnenten und Beiträgen.
--
-- Jetzt hängen die Rechte an public.mitgliedschaften:
--   * eine Person ist Mitglied in höchstens EINEM Verein/Gewerbe (profile_id ist PK),
--   * Mitgliedsrolle 'verwalter' (Profil, Mitglieder, Löschen) oder 'autor' (Beiträge),
--   * profiles.role ist verein/organisation/gewerbe genau dann, wenn es eine
--     Mitgliedschaft gibt (Ausnahme: Selbstanlage steht noch aus). Rolle und
--     Mitgliedschaft ändern nur die Funktionen unten, jeweils in einer Transaktion.
--
-- Rückwärtskompatibel: Alter Code (liest vereine.profile_id) läuft bis zum Deploy
-- weiter. NACH dem Deploy 066 einspielen.
--
-- Spec: docs/superpowers/specs/2026-11-02-vereins-mitglieder-design.md
-- Kontolöschung ändert sich mit — /konto-loeschen und Datenschutzerklärung (Ziffer 7)
-- beschreiben das neue Verhalten.

-- ─── Vorbedingung: niemand ist mehreren Vereinen/Gewerben zugeordnet ─────────
do $$
declare
  v_anzahl int;
begin
  select count(*) into v_anzahl
  from (
    select profile_id
    from (
      select profile_id from public.vereine where profile_id is not null
      union all
      select profile_id from public.organisationen where profile_id is not null
    ) x
    group by profile_id
    having count(*) > 1
  ) d;

  if v_anzahl > 0 then
    raise exception '065: % Konten sind mehreren Vereinen/Gewerben zugeordnet. Vorher bereinigen.', v_anzahl;
  end if;
end $$;

-- ─── Eigentümer-Spalten lockern (werden nicht mehr gelesen, später entfernt) ─
alter table public.vereine alter column profile_id drop not null;
alter table public.vereine drop constraint if exists vereine_profile_id_key;
alter table public.vereine drop constraint if exists vereine_profile_id_fkey;
alter table public.vereine
  add constraint vereine_profile_id_fkey
  foreign key (profile_id) references public.profiles(id) on delete set null;

alter table public.organisationen alter column profile_id drop not null;
alter table public.organisationen drop constraint if exists organisationen_profile_id_fkey;
alter table public.organisationen
  add constraint organisationen_profile_id_fkey
  foreign key (profile_id) references public.profiles(id) on delete set null;

-- ─── Beiträge überleben ihren Autor (Vereins- und Gewerbebeiträge) ───────────
-- Constraint-Name bleibt gleich: Abfragen nutzen profiles_public!posts_author_id_fkey.
alter table public.posts alter column author_id drop not null;
alter table public.posts drop constraint if exists posts_author_id_fkey;
alter table public.posts
  add constraint posts_author_id_fkey
  foreign key (author_id) references public.profiles(id) on delete set null;

-- Alt-Beiträge ohne org_id dem Verein/Gewerbe ihres Autors zuordnen. Rechte und
-- Anzeige hängen ab jetzt an org_id, nicht mehr an author_id.
update public.posts p
   set org_id = v.id
  from public.vereine v
 where p.channel::text = 'verein'
   and p.org_id is null
   and v.profile_id = p.author_id;

update public.posts p
   set org_id = o.id
  from public.organisationen o
 where p.channel::text = 'gewerbe'
   and p.org_id is null
   and o.profile_id = p.author_id;

-- ─── Mitgliedschaften ────────────────────────────────────────────────────────
create table public.mitgliedschaften (
  profile_id       uuid primary key references public.profiles(id) on delete cascade,
  verein_id        uuid references public.vereine(id) on delete cascade,
  organisation_id  uuid references public.organisationen(id) on delete cascade,
  rolle            text not null check (rolle in ('verwalter', 'autor')),
  hinzugefuegt_von uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint mitgliedschaften_genau_ein_ziel check (num_nonnulls(verein_id, organisation_id) = 1)
);

create index mitgliedschaften_verein_idx on public.mitgliedschaften (verein_id);
create index mitgliedschaften_organisation_idx on public.mitgliedschaften (organisation_id);

alter table public.mitgliedschaften enable row level security;

-- Nur die eigene Zeile. Mitgliederlisten lädt der Server mit service_role nach der
-- Berechtigungsprüfung — eine Policy „Mitglieder desselben Vereins“ auf derselben
-- Tabelle wäre rekursiv.
create policy "mitgliedschaften_eigene_lesen" on public.mitgliedschaften
  for select to authenticated
  using (profile_id = auth.uid());

grant select on public.mitgliedschaften to authenticated;
grant select, insert, update, delete on public.mitgliedschaften to service_role;

-- Backfill: bisherige Eigentümer werden Verwalter
insert into public.mitgliedschaften (profile_id, verein_id, rolle)
select profile_id, id, 'verwalter' from public.vereine where profile_id is not null
on conflict (profile_id) do nothing;

insert into public.mitgliedschaften (profile_id, organisation_id, rolle)
select profile_id, id, 'verwalter' from public.organisationen where profile_id is not null
on conflict (profile_id) do nothing;

-- ─── Einladungen in einen bestehenden Verein ─────────────────────────────────
alter table public.einladungen
  add column if not exists mitglied_rolle text
  check (mitglied_rolle in ('verwalter', 'autor'));

-- ─── Rollen-Protokoll: neue Aktionen ─────────────────────────────────────────
-- Name der Constraint ist in Produktion nicht gesichert (Tabelle wurde früher von
-- Hand angelegt) — deshalb über pg_constraint suchen, wie in 011.
do $$
declare
  v_constraint text;
begin
  select conname into v_constraint
  from pg_constraint
  where conrelid = 'public.rollen_log'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%aktion%';

  if v_constraint is not null then
    execute format('alter table public.rollen_log drop constraint %I', v_constraint);
  end if;

  alter table public.rollen_log
    add constraint rollen_log_aktion_check
    check (aktion in (
      'eingeladen', 'rolle_gesetzt', 'rolle_transfer', 'widerrufen',
      'mitglied_hinzugefuegt', 'mitglied_entfernt', 'mitglied_rolle_geaendert', 'verein_geloescht'
    ));
end $$;

-- ═══ Funktionen ═══════════════════════════════════════════════════════════════
-- Fehlercodes (die API übersetzt sie, siehe src/lib/mitgliedschaft.ts rpcFehler):
--   42501 Keine Berechtigung · P0001 fachliche Ablehnung (Meldung wird angezeigt)
--   P0002 nicht gefunden     · 22023 ungültige Angabe

-- ─── Ziel (Verein oder Gewerbe) lesen und für die Transaktion sperren ────────
create or replace function public._vereinsziel(
  p_verein_id uuid,
  p_organisation_id uuid,
  out o_gemeinde_id uuid,
  out o_rolle text,
  out o_name text
)
language plpgsql
security definer
set search_path = ''
as $$
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

-- ─── Recht eines Akteurs auf ein Ziel: 'verwaltung' | 'verwalter' | null ─────
create or replace function public._mitglieder_recht(
  p_akteur uuid,
  p_verein_id uuid,
  p_organisation_id uuid,
  p_gemeinde_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
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

-- ─── Protokoll ───────────────────────────────────────────────────────────────
create or replace function public._rollen_log(
  p_gemeinde_id uuid,
  p_aktion text,
  p_profile_id uuid,
  p_alte text,
  p_neue text,
  p_akteur uuid
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.rollen_log
    (gemeinde_id, aktion, ziel_profile_id, ziel_email, alte_rolle, neue_rolle, ausgefuehrt_von)
  select p_gemeinde_id, p_aktion, p.id, coalesce(p.email, ''), p_alte, p_neue, coalesce(p_akteur, p.id)
    from public.profiles p
   where p.id = p_profile_id
$$;

-- ─── Gibt es außer p_ohne noch einen Verwalter? ──────────────────────────────
create or replace function public._weiterer_verwalter(
  p_verein_id uuid,
  p_organisation_id uuid,
  p_ohne uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.mitgliedschaften m
     where m.profile_id <> p_ohne
       and m.rolle = 'verwalter'
       and (m.verein_id = p_verein_id or m.organisation_id = p_organisation_id)
  )
$$;

-- ─── Eintragen ohne Rechteprüfung (nur intern) ───────────────────────────────
-- p_jede_rolle: true nur für die Verwaltung bei verein_anlegen — dann darf die
-- Person vorher eine beliebige Rolle haben (bewusster Rollenwechsel).
create or replace function public._mitglied_eintragen(
  p_profile_id uuid,
  p_verein_id uuid,
  p_organisation_id uuid,
  p_rolle text,
  p_akteur uuid,
  p_jede_rolle boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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

-- ─── Mitglied hinzufügen (Verwalter des Vereins oder Verwaltung) ─────────────
create or replace function public.mitglied_hinzufuegen(
  p_profile_id uuid,
  p_rolle text,
  p_ausgefuehrt_von uuid,
  p_verein_id uuid default null,
  p_organisation_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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

-- ─── Mitglied entfernen (auch: selbst austreten) ─────────────────────────────
create or replace function public.mitglied_entfernen(
  p_profile_id uuid,
  p_ausgefuehrt_von uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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

-- ─── Mitgliedsrolle ändern ───────────────────────────────────────────────────
create or replace function public.mitglied_rolle_aendern(
  p_profile_id uuid,
  p_rolle text,
  p_ausgefuehrt_von uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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

-- ─── Zeile für Verein (verein/organisation) oder Gewerbe anlegen (nur intern) ─
create or replace function public._vereinszeile_anlegen(
  p_typ text,
  p_gemeinde_id uuid,
  p_name text,
  p_profile_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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

-- ─── Verein/Organisation/Gewerbe anlegen, Person wird Verwalter ──────────────
-- Erlaubt für
--   * die Verwaltung der Gemeinde (Person ohne Mitgliedschaft, beliebige Rolle),
--   * die Person selbst, wenn ihre Rolle zum Typ passt (Selbstanlage im Dashboard).
create or replace function public.verein_anlegen(
  p_profile_id uuid,
  p_typ text,
  p_name text,
  p_ausgefuehrt_von uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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

-- ─── Einladung beim Registrieren einlösen ────────────────────────────────────
-- profilAnlegen markiert die Einladung als angenommen und legt das Profil mit der
-- eingeladenen Rolle an; danach entsteht hier die Mitgliedschaft.
create or replace function public.einladung_einloesen(
  p_profile_id uuid,
  p_einladung_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e record;
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
  if e.status <> 'angenommen' then
    raise exception 'Die Einladung wurde nicht angenommen.' using errcode = 'P0001';
  end if;

  if e.rolle not in ('verein', 'organisation', 'gewerbe') then
    return;
  end if;

  if e.verein_id is not null or e.org_id is not null then
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

-- ═══ Grants ═══════════════════════════════════════════════════════════════════
-- Hilfsfunktionen (_…) nur intern. Öffentliche Funktionen nur für service_role:
-- die API-Routen übergeben die Akteur-ID aus der Session, nie aus dem Request.
revoke all on function public._vereinsziel(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public._mitglieder_recht(uuid, uuid, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public._rollen_log(uuid, text, uuid, text, text, uuid) from public, anon, authenticated, service_role;
revoke all on function public._weiterer_verwalter(uuid, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public._mitglied_eintragen(uuid, uuid, uuid, text, uuid, boolean) from public, anon, authenticated, service_role;
revoke all on function public._vereinszeile_anlegen(text, uuid, text, uuid) from public, anon, authenticated, service_role;

revoke all on function public.mitglied_hinzufuegen(uuid, text, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.mitglied_entfernen(uuid, uuid) from public, anon, authenticated;
revoke all on function public.mitglied_rolle_aendern(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.mitglied_hinzufuegen(uuid, text, uuid, uuid, uuid) to service_role;
grant execute on function public.mitglied_entfernen(uuid, uuid) to service_role;
grant execute on function public.mitglied_rolle_aendern(uuid, text, uuid) to service_role;

revoke all on function public.verein_anlegen(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.einladung_einloesen(uuid, uuid) from public, anon, authenticated;
grant execute on function public.verein_anlegen(uuid, text, text, uuid) to service_role;
grant execute on function public.einladung_einloesen(uuid, uuid) to service_role;
